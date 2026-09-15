import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, lt, or } from "drizzle-orm";
import type { z } from "zod";
import {
  paymentCredentials as credentials,
  paymentGatewaySettings as settings,
  providerPayments as payments,
  type ProviderPayment,
} from "../drizzle/paymentSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import { memberAccounts } from "../drizzle/memberSchema";
import { providerRecords } from "../drizzle/schema";
import {
  paymentGateways,
  paymentQuote,
  nextPaidMonth,
  type PaymentGateway,
  type gatewaySettingsInput,
} from "../shared/providerPayments";
import { providerHost } from "../shared/providerBusiness";
import {
  businessDatabase,
  lockedProviderOwner,
  type BusinessTransaction,
} from "./providerEntitlements";
import { lockedAuth, type MemberAuth } from "./memberDb";
import { encryptValue, decryptValue } from "./security";
import { writeAudit } from "./marketplaceDb";
import { memberAuthOrigin } from "./memberSecurity";
import {
  createGatewayCheckout,
  gatewaySecrets,
  paymentFail,
  checkPaypal,
  checkNowPayment,
  validateGatewayConfig,
  type GatewayConfig,
  type VerifiedPayment,
} from "./paymentGateways";

export async function paymentConfig(id: string): Promise<GatewayConfig> {
  const db = await businessDatabase();
  const [row] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, id));
  if (!row) paymentFail("configuration", "SERVICE_UNAVAILABLE");
  const secrets = gatewaySecrets.parse(
    JSON.parse(decryptValue(row, `payment-gateway:${row.id}`))
  );
  if (secrets.gateway !== row.gateway)
    paymentFail("configuration", "SERVICE_UNAVAILABLE");
  return { id: row.id, environment: row.environment, secrets };
}
export async function gatewaySettings() {
  const db = await businessDatabase();
  const rows = await db
    .select({
      gateway: settings.gateway,
      enabled: settings.enabled,
      revision: settings.revision,
      credentialId: settings.credentialId,
      environment: credentials.environment,
    })
    .from(settings)
    .leftJoin(credentials, eq(credentials.id, settings.credentialId));
  return paymentGateways.map(gateway => {
    const row = rows.find(r => r.gateway === gateway);
    return {
      gateway,
      enabled: row?.enabled ?? false,
      revision: row?.revision ?? 0,
      configured: Boolean(row?.credentialId),
      environment: row?.environment ?? "live",
      webhookUrl: `${memberAuthOrigin()}/api/payments/${gateway}/webhook`,
    };
  });
}
export async function publicPaymentMethods() {
  return (await gatewaySettings()).map(row => ({
    gateway: row.gateway,
    available: row.enabled && row.configured && row.environment === "live",
  }));
}
export async function saveGatewaySettings(
  actorId: number,
  input: z.infer<typeof gatewaySettingsInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const [current] = await tx
      .select()
      .from(settings)
      .where(eq(settings.gateway, input.gateway))
      .for("update");
    if (!current || current.revision !== input.revision)
      paymentFail("changed", "CONFLICT");
    if (input.gateway === "nowpayments" && input.environment !== "live")
      paymentFail("configuration");
    let old: GatewayConfig | null = null;
    if (current.credentialId) old = await paymentConfig(current.credentialId);
    const previous =
      old?.environment === input.environment ? old.secrets : undefined;
    const selected =
      input.gateway === "paypal"
        ? {
            gateway: input.gateway,
            clientId:
              input.clientId ||
              (previous?.gateway === "paypal" ? previous.clientId : ""),
            clientSecret:
              input.clientSecret ||
              (previous?.gateway === "paypal" ? previous.clientSecret : ""),
            webhookId:
              input.webhookId ||
              (previous?.gateway === "paypal" ? previous.webhookId : ""),
            merchantId:
              input.merchantId ||
              (previous?.gateway === "paypal" ? previous.merchantId : ""),
          }
        : {
            gateway: input.gateway,
            apiKey:
              input.apiKey ||
              (previous?.gateway === "nowpayments" ? previous.apiKey : ""),
            ipnSecret:
              input.ipnSecret ||
              (previous?.gateway === "nowpayments" ? previous.ipnSecret : ""),
          };
    const parsed = gatewaySecrets.safeParse(selected);
    if (!parsed.success) paymentFail("configuration");
    const id = randomUUID();
    if (input.enabled)
      await validateGatewayConfig({
        id,
        environment: input.environment,
        secrets: parsed.data,
      });
    const encrypted = encryptValue(
      JSON.stringify(parsed.data),
      `payment-gateway:${id}`
    );
    await tx
      .insert(credentials)
      .values({
        id,
        gateway: input.gateway,
        environment: input.environment,
        ...encrypted,
      });
    await tx
      .update(settings)
      .set({
        credentialId: id,
        enabled: input.enabled,
        revision: current.revision + 1,
      })
      .where(eq(settings.gateway, input.gateway));
    await writeAudit(
      {
        actorUserId: actorId,
        action: "payments.gateway.updated",
        entityType: "payment_gateway",
        entityId: input.gateway,
        summary: "Updated encrypted payment gateway configuration",
        metadata: {
          environment: input.environment,
          enabled: input.enabled,
          revision: current.revision + 1,
        },
      },
      tx
    );
    return { ok: true };
  });
}
function publicPayment(row: ProviderPayment) {
  return {
    id: row.id,
    providerId: row.providerId,
    gateway: row.gateway,
    state: row.state,
    amountCents: row.amountCents,
    currency: row.currency,
    checkoutUrl:
      ["creating", "pending"].includes(row.state) && row.expiresAt > new Date()
        ? row.checkoutUrl
        : null,
    gatewayStatus: row.gatewayStatus,
    reviewReason: row.reviewReason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    appliedAt: row.appliedAt,
    periodStartsAt: row.periodStartsAt,
    periodEndsAt: row.periodEndsAt,
  };
}
export async function paymentById(id: string) {
  const [row] = await (await businessDatabase())
    .select()
    .from(payments)
    .where(eq(payments.id, id));
  return row ?? null;
}
export async function paymentByGatewayOrder(
  gateway: PaymentGateway,
  id: string
) {
  const [row] = await (
    await businessDatabase()
  )
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.gateway, gateway),
        eq(payments.environment, "live"),
        eq(payments.gatewayOrderId, id)
      )
    );
  return row ?? null;
}
export async function paymentByTransaction(
  gateway: PaymentGateway,
  id: string
) {
  const [row] = await (
    await businessDatabase()
  )
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.gateway, gateway),
        eq(payments.environment, "live"),
        eq(payments.transactionId, id)
      )
    );
  return row ?? null;
}
export async function ownerPayments(auth: MemberAuth, providerId: number) {
  const db = await businessDatabase();
  const result = await db.transaction(async tx => {
    const { account } = await lockedProviderOwner(tx, auth, providerId, false);
    const rows = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.providerId, providerId),
          eq(payments.memberId, auth.member.id)
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(20);
    return {
      quote: paymentQuote(account),
      allowed: account.status !== "suspended",
      items: rows.map(publicPayment),
    };
  });
  return { ...result, methods: await publicPaymentMethods() };
}
export async function ownerPayment(auth: MemberAuth, id: string) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    const [row] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.memberId, member.id)));
    if (!row) paymentFail("missing", "NOT_FOUND");
    return publicPayment(row);
  });
}
export async function startProviderCheckout(
  auth: MemberAuth,
  providerId: number,
  gateway: PaymentGateway
) {
  const db = await businessDatabase();
  const result = await db.transaction(async tx => {
    const { account, member } = await lockedProviderOwner(
      tx,
      auth,
      providerId,
      false
    );
    if (account.status === "suspended") paymentFail("suspended", "FORBIDDEN");
    const [setting] = await tx
      .select({ setting: settings, environment: credentials.environment })
      .from(settings)
      .leftJoin(credentials, eq(credentials.id, settings.credentialId))
      .where(eq(settings.gateway, gateway));
    if (
      !setting?.setting.enabled ||
      !setting.setting.credentialId ||
      setting.environment !== "live"
    )
      paymentFail("unavailable", "SERVICE_UNAVAILABLE");
    const now = new Date();
    const [open] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.providerId, providerId),
          or(
            and(
              inArray(payments.state, ["creating", "pending"]),
              gt(payments.expiresAt, now)
            ),
            eq(payments.state, "review")
          )
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (open) {
      if (
        open.memberId !== member.id ||
        open.gateway !== gateway ||
        open.state === "review"
      )
        paymentFail("open_payment", "CONFLICT");
      return { row: open, created: false };
    }
    const quote = paymentQuote(account, now);
    const id = randomUUID();
    await tx
      .insert(payments)
      .values({
        id,
        providerId,
        memberId: member.id,
        gateway,
        credentialId: setting.setting.credentialId,
        environment: "live",
        amountCents: quote.amountCents,
        accountRevision: account.revision,
        expiresAt: new Date(now.getTime() + 3 * 3_600_000),
      });
    const [row] = await tx.select().from(payments).where(eq(payments.id, id));
    return { row, created: true };
  });
  if (!result.created) return publicPayment(result.row);
  try {
    const config = await paymentConfig(result.row.credentialId);
    const checkout = await createGatewayCheckout(result.row, config);
    // Preserve a cancellation or verified callback that raced checkout creation.
    await db
      .update(payments)
      .set({ ...checkout, state: "pending" })
      .where(
        and(eq(payments.id, result.row.id), eq(payments.state, "creating"))
      );
  } catch (error) {
    await db
      .update(payments)
      .set({ reviewReason: "checkout_unavailable" })
      .where(
        and(eq(payments.id, result.row.id), eq(payments.state, "creating"))
      );
    throw error;
  }
  return publicPayment((await paymentById(result.row.id))!);
}
export async function cancelProviderCheckout(auth: MemberAuth, id: string) {
  await (
    await businessDatabase()
  ).transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    await tx
      .update(payments)
      .set({ state: "expired" })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.memberId, member.id),
          inArray(payments.state, ["creating", "pending"])
        )
      );
  });
  return { ok: true };
}
export async function paypalCaptureAllowed(row: ProviderPayment) {
  if (
    row.state !== "pending" ||
    row.expiresAt <= new Date() ||
    !row.providerId ||
    !row.memberId
  )
    return false;
  const db = await businessDatabase();
  const [current] = await db
    .select({
      account: accounts,
      member: memberAccounts,
      provider: providerRecords,
    })
    .from(accounts)
    .innerJoin(memberAccounts, eq(memberAccounts.id, accounts.ownerMemberId))
    .innerJoin(providerRecords, eq(providerRecords.id, accounts.providerId))
    .where(eq(accounts.providerId, row.providerId));
  return Boolean(
    current &&
      current.account.status !== "suspended" &&
      current.account.revision === row.accountRevision &&
      current.account.ownerMemberId === row.memberId &&
      current.account.ownershipVerifiedAt &&
      current.account.ownerHost === providerHost(current.provider.websiteUrl) &&
      current.provider.status === "active" &&
      current.member.status === "active" &&
      current.member.emailVerifiedAt
  );
}
async function paymentAudit(
  tx: BusinessTransaction,
  row: ProviderPayment,
  action: string,
  metadata: Record<string, unknown> = {},
  actorId?: number
) {
  await writeAudit(
    {
      actorUserId: actorId,
      action: `payments.${action}`,
      entityType: "provider_payment",
      entityId: row.id,
      summary: `Provider payment ${action}`,
      metadata: {
        providerId: row.providerId,
        gateway: row.gateway,
        amountCents: row.amountCents,
        currency: row.currency,
        ...metadata,
      },
    },
    tx
  );
}
/** Only adapters that verified the gateway's server response call this function. */
export async function recordVerifiedPayment(
  id: string,
  verified: VerifiedPayment,
  manual?: { actorId: number; note: string }
) {
  const db = await businessDatabase();
  const initial = await paymentById(id);
  if (!initial) return;
  return db.transaction(async tx => {
    // Match member -> provider -> business account lock order used by checkout.
    const [member] = initial.memberId
      ? await tx
          .select()
          .from(memberAccounts)
          .where(eq(memberAccounts.id, initial.memberId))
          .for("update")
      : [];
    const [provider] = initial.providerId
      ? await tx
          .select()
          .from(providerRecords)
          .where(eq(providerRecords.id, initial.providerId))
          .for("update")
      : [];
    const [account] = initial.providerId
      ? await tx
          .select()
          .from(accounts)
          .where(eq(accounts.providerId, initial.providerId))
          .for("update")
      : [];
    const [row] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .for("update");
    if (!row || row.environment !== "live") return;
    if (
      manual &&
      (row.state !== "review" ||
        !row.verifiedAt ||
        !row.transactionId ||
        row.appliedAt)
    )
      paymentFail("not_verified", "CONFLICT");
    if (row.state === "refunded") return;
    if (
      row.reviewReason === "operator_closed" &&
      row.verifiedAt &&
      verified.state === "paid" &&
      row.transactionId === verified.transactionId
    )
      return;
    if (row.appliedAt && verified.state !== "refunded") {
      if (
        verified.state === "paid" &&
        row.transactionId !== verified.transactionId
      ) {
        await tx
          .update(payments)
          .set({ reviewReason: "additional_payment" })
          .where(eq(payments.id, id));
        await paymentAudit(tx, row, "additional_payment", {
          transactionId: verified.transactionId,
        });
      }
      return;
    }
    const transactionId = verified.transactionId ?? row.transactionId;
    if (row.verifiedAt && verified.state === "pending") return;
    if (verified.state === "refunded") {
      if (row.transactionId && verified.transactionId !== row.transactionId)
        return;
      await tx
        .update(payments)
        .set({
          state: "refunded",
          gatewayStatus: verified.gatewayStatus,
          transactionId,
          reviewReason: row.appliedAt ? "refund_access_review" : null,
        })
        .where(eq(payments.id, id));
      if (row.appliedAt && account)
        await tx
          .update(accounts)
          .set({ status: "suspended", revision: account.revision + 1 })
          .where(eq(accounts.providerId, account.providerId));
      await paymentAudit(tx, row, "refunded", {
        transactionId,
        accessSuspended: Boolean(row.appliedAt && account),
      });
      return;
    }
    if (verified.state !== "paid") {
      if (row.verifiedAt) return;
      await tx
        .update(payments)
        .set({
          gatewayStatus: verified.gatewayStatus,
          transactionId,
          state: row.state === "expired" ? "expired" : verified.state,
          reviewReason: verified.reason ?? row.reviewReason,
        })
        .where(eq(payments.id, id));
      return;
    }
    if (!transactionId) paymentFail("not_verified");
    const now = new Date();
    const reason =
      !member ||
      member.status !== "active" ||
      !member.emailVerifiedAt ||
      !provider ||
      provider.status !== "active" ||
      !account ||
      !account.ownershipVerifiedAt ||
      account.ownerMemberId !== row.memberId ||
      account.ownerHost !== providerHost(provider.websiteUrl)
        ? "ownership_changed"
        : account.status === "suspended"
          ? "suspended"
          : !manual && (row.state === "expired" || row.expiresAt < now)
            ? "late_payment"
            : !manual && account.revision !== row.accountRevision
              ? "subscription_changed"
              : null;
    if (reason) {
      await tx
        .update(payments)
        .set({
          state: "review",
          verifiedAt: row.verifiedAt ?? now,
          transactionId,
          gatewayStatus: verified.gatewayStatus,
          reviewReason: reason,
        })
        .where(eq(payments.id, id));
      await paymentAudit(tx, row, "review", { transactionId, reason });
      return;
    }
    const start =
      account!.status === "active" && account!.endsAt && account!.endsAt > now
        ? account!.endsAt
        : now;
    const first = account!.firstActivatedAt ?? start;
    const end = nextPaidMonth(start, first);
    await tx
      .update(accounts)
      .set({
        status: "active",
        startsAt:
          account!.status === "active" &&
          account!.startsAt &&
          account!.endsAt &&
          account!.endsAt > now
            ? account!.startsAt
            : start,
        endsAt: end,
        firstActivatedAt: first,
        revision: account!.revision + 1,
      })
      .where(eq(accounts.providerId, account!.providerId));
    await tx
      .update(payments)
      .set({
        state: "paid",
        verifiedAt: row.verifiedAt ?? now,
        appliedAt: now,
        transactionId,
        gatewayStatus: verified.gatewayStatus,
        reviewReason: null,
        periodStartsAt: start,
        periodEndsAt: end,
      })
      .where(eq(payments.id, id));
    await paymentAudit(
      tx,
      row,
      "applied",
      {
        transactionId,
        periodStartsAt: start.toISOString(),
        periodEndsAt: end.toISOString(),
        ...(manual ? { note: manual.note } : {}),
      },
      manual?.actorId
    );
  });
}
export async function recheckProviderPayment(auth: MemberAuth, id: string) {
  await ownerPayment(auth, id);
  const row = (await paymentById(id))!;
  if (row.appliedAt || row.state === "refunded") return publicPayment(row);
  const config = await paymentConfig(row.credentialId);
  if (row.gateway === "paypal" && row.gatewayOrderId) {
    const canCapture = await paypalCaptureAllowed(row);
    await recordVerifiedPayment(id, await checkPaypal(row, config, canCapture));
  } else if (row.gateway === "nowpayments" && row.transactionId) {
    await recordVerifiedPayment(
      id,
      await checkNowPayment(row, config, row.transactionId)
    );
  }
  return publicPayment((await paymentById(id))!);
}
export async function adminPayments(cursor?: string) {
  const db = await businessDatabase();
  const after = cursor ? await paymentById(cursor) : null;
  if (cursor && !after) paymentFail("missing", "NOT_FOUND");
  const rows = await db
    .select({ payment: payments, providerName: providerRecords.name })
    .from(payments)
    .leftJoin(providerRecords, eq(providerRecords.id, payments.providerId))
    .where(
      after
        ? or(
            lt(payments.createdAt, after.createdAt),
            and(
              eq(payments.createdAt, after.createdAt),
              lt(payments.id, after.id)
            )
          )
        : undefined
    )
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .limit(31);
  return {
    items: rows
      .slice(0, 30)
      .map(({ payment, providerName }) => ({
        ...publicPayment(payment),
        providerName,
        transactionId: payment.transactionId,
        verifiedAt: payment.verifiedAt,
      })),
    nextCursor: rows.length > 30 ? rows[29].payment.id : null,
  };
}
export async function applyReviewedPayment(
  actorId: number,
  id: string,
  note: string
) {
  const row = await paymentById(id);
  if (
    !row ||
    row.state !== "review" ||
    !row.verifiedAt ||
    !row.transactionId ||
    row.appliedAt
  )
    paymentFail("not_verified", "CONFLICT");
  // Recheck immediately before applying an operator's reviewed payment.
  const config = await paymentConfig(row.credentialId);
  const remote =
    row.gateway === "paypal"
      ? await checkPaypal(row, config, false)
      : await checkNowPayment(row, config, row.transactionId);
  if (remote.state !== "paid") {
    await recordVerifiedPayment(id, remote);
    paymentFail("not_verified", "CONFLICT");
  }
  await recordVerifiedPayment(id, remote, { actorId, note });
  return { state: (await paymentById(id))!.state };
}
export async function closeReviewedPayment(
  actorId: number,
  id: string,
  note: string
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .for("update");
    if (!row || row.state !== "review" || row.appliedAt)
      paymentFail("changed", "CONFLICT");
    // Record an operator's resolution without claiming a refund or adding access.
    await tx
      .update(payments)
      .set({ state: "expired", reviewReason: "operator_closed" })
      .where(eq(payments.id, id));
    await paymentAudit(tx, row, "review_closed", { note }, actorId);
    return { ok: true };
  });
}
