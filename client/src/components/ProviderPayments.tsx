import { useEffect, useRef } from "react";
import { CreditCard, Coins } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { nowpaymentsCheckoutAsset } from "../../../shared/providerPayments";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { paymentText, paymentError } from "@/i18n/providerPayments";
import {
  businessPrimary,
  businessSecondary,
  useBusinessClock,
} from "./BusinessUi";

type Payment = inferRouterOutputs<AppRouter>["business"]["payments"]["status"];
export const paymentUsd = (cents: number) => `$${(cents / 100).toFixed(2)} USD`;
function PaymentAlert({ message }: { message?: string }) {
  const { locale } = useLocale();
  return message ? (
    <p
      role="alert"
      className="mt-3 rounded-xl bg-warning-muted p-3 text-sm leading-7 text-warning"
    >
      {paymentError(message, locale)}
    </p>
  ) : null;
}
export function PaymentMethods() {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const query = trpc.business.payments.methods.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-sm font-semibold text-secondary-foreground">{t.methods}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(["paypal", "nowpayments"] as const).map(gateway => (
          <span
            key={gateway}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-secondary-foreground"
          >
            {gateway === "paypal" ? (
              <CreditCard className="size-4" />
            ) : (
              <Coins className="size-4" />
            )}
            <bdi>
              {gateway === "paypal"
                ? "PayPal"
                : `${nowpaymentsCheckoutAsset.label} · NOWPayments`}
            </bdi>
            {!query.data?.find(m => m.gateway === gateway)?.available && (
              <span className="text-xs text-muted-foreground">{t.unavailable}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
export function PaymentStatusCard({
  payment,
  refresh,
  readOnly = false,
}: {
  payment: Payment;
  refresh?: () => Promise<unknown>;
  readOnly?: boolean;
}) {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const utils = trpc.useUtils();
  const now = useBusinessClock();
  const update = async () => {
    await Promise.all([
      utils.business.mine.invalidate(),
      utils.business.payments.invalidate(),
    ]);
    await refresh?.();
  };
  const check = trpc.business.payments.check.useMutation({ onSuccess: update });
  const cancel = trpc.business.payments.cancel.useMutation({
    onSuccess: update,
  });
  const open = ["creating", "pending"].includes(payment.state);
  const state =
    open && new Date(payment.expiresAt).getTime() <= now
      ? "expired"
      : payment.state;
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <p
          role="status"
          className={`font-bold ${state === "paid" ? "text-foreground" : "text-foreground"}`}
        >
          {t[state]}
        </p>
        <bdi className="font-semibold">{paymentUsd(payment.amountCents)}</bdi>
      </div>
      <p className="mt-2 text-sm text-secondary-foreground">
        {payment.gateway === "paypal" ? "PayPal" : "NOWPayments"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t.reference}: <bdi className="break-all">{payment.id}</bdi>
      </p>
      {payment.periodStartsAt && payment.periodEndsAt && (
        <p className="mt-3 text-sm">
          {t.dates}:{" "}
          <bdi>
            {date(payment.periodStartsAt)} — {date(payment.periodEndsAt)} UTC
          </bdi>
        </p>
      )}
      {state === "review" && (
        <p className="mt-3 text-sm leading-7 text-warning">{t.reviewHelp}</p>
      )}
      {!readOnly && !["paid", "refunded"].includes(state) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {payment.checkoutUrl && state !== "expired" && (
            <a
              className={businessPrimary}
              href={payment.checkoutUrl}
              rel="noreferrer"
            >
              {t.resume}
            </a>
          )}
          <button
            className={businessSecondary}
            disabled={check.isPending || cancel.isPending}
            onClick={() => check.mutate({ paymentId: payment.id })}
          >
            {t.check}
          </button>
          {open && (
            <button
              className={businessSecondary}
              disabled={cancel.isPending || check.isPending}
              onClick={() => cancel.mutate({ paymentId: payment.id })}
            >
              {t.cancel}
            </button>
          )}
          <a
            className={businessSecondary}
            href={`mailto:soporte@providerbeacon.com?subject=${encodeURIComponent(`Payment ${payment.id}`)}`}
          >
            {t.support}
          </a>
        </div>
      )}
      {!readOnly && open && (
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{t.cancelHelp}</p>
      )}
      <PaymentAlert message={check.error?.message ?? cancel.error?.message} />
    </article>
  );
}
export function PaymentReturn({ accountId }: { accountId: number }) {
  const raw = new URLSearchParams(window.location.search).get("payment");
  const id = raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  return id ? (
    <ReturnedPayment key={`${accountId}:${id}`} accountId={accountId} id={id} />
  ) : null;
}
function ReturnedPayment({ accountId, id }: { accountId: number; id: string }) {
  const utils = trpc.useUtils();
  const attempted = useRef(false);
  const applied = useRef(false);
  const query = trpc.business.payments.status.useQuery(
    { accountId, paymentId: id },
    {
      retry: false,
      refetchInterval: q =>
        q.state.data?.state === "pending" || q.state.data?.state === "creating"
          ? 10_000
          : false,
    }
  );
  const check = trpc.business.payments.check.useMutation({
    onSuccess: async () => {
      await utils.business.payments.invalidate();
      await utils.business.mine.invalidate();
    },
  });
  useEffect(() => {
    if (query.data && !attempted.current) {
      attempted.current = true;
      if (["creating", "pending"].includes(query.data.state))
        check.mutate({ paymentId: id });
    }
  }, [query.data, id, check]);
  useEffect(() => {
    if (query.data?.state === "paid" && !applied.current) {
      applied.current = true;
      void utils.business.mine.invalidate();
    }
  }, [query.data?.state, utils]);
  if (query.isError) return <PaymentAlert message={query.error.message} />;
  return query.data ? (
    <div className="mb-6">
      <PaymentStatusCard payment={query.data} refresh={query.refetch} />
      <PaymentAlert message={check.error?.message} />
    </div>
  ) : null;
}
export function ProviderCheckout({
  accountId,
  providerId,
  showHistory = false,
}: {
  accountId: number;
  providerId: number;
  showHistory?: boolean;
}) {
  const { locale } = useLocale();
  const t = paymentText(locale);
  const now = useBusinessClock();
  const utils = trpc.useUtils();
  const query = trpc.business.payments.list.useQuery(
    { accountId, providerId },
    { retry: false, staleTime: 0, refetchInterval: 15_000 }
  );
  const checkout = trpc.business.payments.checkout.useMutation({
    onSuccess: async payment => {
      await utils.business.payments.invalidate();
      if (payment.checkoutUrl) window.location.assign(payment.checkoutUrl);
    },
  });
  if (query.isError) return <PaymentAlert message={query.error.message} />;
  if (!query.data) return null;
  const open = query.data.items.find(
    p =>
      ["creating", "pending", "review"].includes(p.state) &&
      (p.state === "review" || new Date(p.expiresAt).getTime() > now)
  );
  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="font-bold text-foreground">{t.checkout}</h3>
      <p className="mt-3 text-sm leading-7 text-secondary-foreground">{t.terms}</p>
      <p className="mt-4 font-semibold">
        {t.renewal}: <bdi>{paymentUsd(query.data.quote.amountCents)}</bdi>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {query.data.methods.map(method => (
          <button
            key={method.gateway}
            className={
              method.gateway === "paypal" ? businessPrimary : businessSecondary
            }
            disabled={
              !method.available ||
              !query.data.allowed ||
              checkout.isPending ||
              Boolean(open)
            }
            onClick={() =>
              checkout.mutate({ providerId, gateway: method.gateway })
            }
          >
            {method.gateway === "paypal" ? (
              <CreditCard className="size-4" />
            ) : (
              <Coins className="size-4" />
            )}
            {t.use}{" "}
            {method.gateway === "paypal"
              ? "PayPal"
              : nowpaymentsCheckoutAsset.label}
            {!method.available && (
              <span className="text-xs">({t.unavailable})</span>
            )}
          </button>
        ))}
      </div>
      {!query.data.allowed && (
        <p className="mt-3 text-sm text-warning">{t.suspended}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-muted-foreground">{t.cryptoHelp}</p>
      <PaymentAlert message={checkout.error?.message} />
      {query.data.items.length > 0 && (
        <details className="mt-5" open={showHistory || Boolean(open)}>
          <summary className="cursor-pointer text-sm font-semibold">
            {t.history}
          </summary>
          <div className="mt-3 space-y-3">
            {query.data.items.map(payment => (
              <PaymentStatusCard key={payment.id} payment={payment} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
