import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { memberComparisons, memberWatches } from "../drizzle/workspaceSchema";
import {
  priceSnapshots,
  providerRecords,
  serviceRecords,
} from "../drizzle/schema";
import {
  authenticateMemberSession,
  logoutMember,
  registerMember,
} from "./memberDb";
import { memberCookieName } from "./memberSecurity";
import { invalidateCatalogueCaches } from "./catalogueCache";
import {
  readWorkspace,
  removeWorkspaceItem,
  saveComparison,
  saveWatch,
  setWatchTarget,
  watchHistory,
} from "./buyerWorkspace";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { assistantRankedSearch } from "./assistantRankedSearch";
import * as exchange from "./assistantExchange";
import type { AssistantPlan } from "../shared/assistant";

export function workspaceAcceptanceCases(
  database: () => any,
  providerId: () => number
) {
  describe("buyer workspace and catalogue-wide cost search", () => {
    beforeEach(async () => {
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      vi.stubEnv("AUTH_PEPPER", "workspace-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
    });
    async function member(email = "workspace@example.com") {
      const result = await registerMember({
        name: "Workspace test",
        email,
        password: "a long local workspace password",
      });
      return { result, auth: (await authenticateMemberSession(result.token))! };
    }
    async function service(patch: Record<string, unknown> = {}) {
      const [row] = await database()
        .insert(serviceRecords)
        .values({
          providerId: providerId(),
          externalId: "test",
          slug: `offer-${Math.random()}`,
          name: "Instagram followers",
          platform: "Instagram",
          category: "Followers",
          countryCode: "WW",
          refillMode: "none",
          priceAmount: "2.6000",
          minOrder: 1,
          maxOrder: 10000,
          status: "active",
          reviewStatus: "approved",
          incomplete: false,
          normalizationVersion: 1,
          pricingConfirmed: true,
          priceCurrency: "USD",
          priceUnit: "per_1000",
          policyReviewed: true,
          evidenceUrl: "https://provider.example/prices",
          priceCheckedAt: new Date(),
          sourceUpdatedAt: new Date(),
          ...patch,
        })
        .$returningId();
      invalidateCatalogueCaches();
      return row.id as number;
    }
    it("saves idempotently, records a real baseline and preserves account boundaries", async () => {
      const first = await member();
      const second = await member("other-workspace@example.com");
      const id = await service();
      const watches = await Promise.all([
        saveWatch(first.auth, { serviceId: `service-${id}`, quantity: 5000 }),
        saveWatch(first.auth, { serviceId: `service-${id}`, quantity: 5000 }),
      ]);
      expect(watches[0]!.id).toBe(watches[1]!.id);
      expect(await database().select().from(memberWatches)).toHaveLength(1);
      expect(
        (await readWorkspace(first.auth)).watches[0]!.change
      ).toMatchObject({ original: "13.00", now: "13.00", status: "same" });
      expect((await readWorkspace(second.auth)).watches).toEqual([]);
      await removeWorkspaceItem(second.auth, watches[0]!.id, "watch");
      await expect(
        setWatchTarget(second.auth, { id: watches[0]!.id, target: "12" })
      ).rejects.toThrow("workspace_missing");
      await expect(watchHistory(second.auth, watches[0]!.id)).rejects.toThrow(
        "workspace_missing"
      );
      expect((await readWorkspace(first.auth)).watches).toHaveLength(1);
      await logoutMember(first.result.token, true);
      await expect(
        removeWorkspaceItem(first.auth, watches[0]!.id, "watch")
      ).rejects.toThrow();
    });
    it("returns exact price changes and targets while excluding incompatible or unverified history", async () => {
      const { auth } = await member();
      const id = await service();
      const { id: watchId } = await saveWatch(auth, {
        serviceId: `service-${id}`,
        quantity: 5000,
      });
      await setWatchTarget(auth, { id: watchId, target: "12.00" });
      const initial = (await readWorkspace(auth)).watches[0]!;
      await database()
        .update(serviceRecords)
        .set({
          priceAmount: "2.4000",
          priceCheckedAt: new Date(Date.now() + 2000),
        })
        .where(eq(serviceRecords.id, id));
      await database()
        .insert(priceSnapshots)
        .values([
          {
            serviceId: id,
            priceAmount: "0.0100",
            sourceRate: "0.01",
            priceCurrency: "USD",
            priceUnit: "per_1000",
            kind: "review",
            comparisonKey: null,
          },
          {
            serviceId: id,
            priceAmount: "0.0200",
            sourceRate: "0.02",
            priceCurrency: "USD",
            priceUnit: "per_1000",
            kind: "review",
            comparisonKey: "different-terms",
          },
        ]);
      invalidateCatalogueCaches();
      expect((await readWorkspace(auth)).watches[0]!.change).toMatchObject({
        original: "13.00",
        now: "12.00",
        status: "lower",
        targetReached: true,
      });
      const history = await watchHistory(auth, watchId);
      expect(history.points.map(p => Number(p.rate))).toEqual([2.6, 2.4]);
      await database()
        .update(serviceRecords)
        .set({ priceCurrency: "INR" })
        .where(eq(serviceRecords.id, id));
      invalidateCatalogueCaches();
      expect((await readWorkspace(auth)).watches[0]!.change).toMatchObject({
        status: "terms_changed",
        targetReached: false,
      });
      expect(
        (await watchHistory(auth, watchId)).points.map(p => Number(p.rate))
      ).toEqual([2.4]);
      await database()
        .update(providerRecords)
        .set({ status: "suspended" })
        .where(eq(providerRecords.id, providerId()));
      invalidateCatalogueCaches();
      expect((await readWorkspace(auth)).watches[0]!.candidate).toBeNull();
      expect((await watchHistory(auth, watchId)).points).toEqual([]);
      expect(initial.baseline.historyKey).toBeTruthy();
    });
    it("keeps saved comparisons private and applies visitor origin, session and cache partition checks", async () => {
      const { auth, result } = await member();
      const id = await service();
      const second = await service();
      const request = {
        headers: {
          cookie: `${memberCookieName("session")}=${result.token}`,
          origin: "https://providerbeacon.com",
        },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() };
      const caller = appRouter.createCaller(
        await createContext({ req: request, res } as any)
      );
      const watch = await caller.workspace.watch({
        serviceId: `service-${id}`,
        quantity: 1000,
      });
      expect(
        (
          await caller.workspace.history({
            accountId: auth.member.id,
            id: watch.id,
          })
        ).points
      ).toHaveLength(1);
      await expect(
        caller.workspace.dashboard({ accountId: auth.member.id + 999 })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const input = {
        serviceIds: [`service-${id}`, `service-${second}`],
        quantity: 5000,
        currency: "USD" as const,
        name: "My comparison",
      };
      expect(await saveComparison(auth, input)).toEqual(
        await saveComparison(auth, {
          ...input,
          serviceIds: [...input.serviceIds].reverse(),
        })
      );
      expect(await database().select().from(memberComparisons)).toHaveLength(1);
      const hostile = appRouter.createCaller(
        await createContext({
          req: {
            ...request,
            headers: { ...request.headers, origin: "https://evil.example" },
          },
          res,
        } as any)
      );
      await expect(
        hostile.workspace.remove({ id: watch.id, kind: "watch" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      await database().delete(serviceRecords).where(eq(serviceRecords.id, id));
      invalidateCatalogueCaches();
      expect((await readWorkspace(auth)).watches[0]!.change.status).toBe(
        "unavailable"
      );
      await database()
        .delete(memberAccounts)
        .where(eq(memberAccounts.id, auth.member.id));
      expect(await database().select().from(memberWatches)).toEqual([]);
      expect(await database().select().from(memberComparisons)).toEqual([]);
    });
    it("finds cheaper offers beyond the first provider and service pages, with currency and unit conversion", async () => {
      const low = await service({ priceAmount: "0.3000" });
      for (let index = 0; index < 10; index++) {
        const [provider] = await database()
          .insert(providerRecords)
          .values({
            slug: `workspace-provider-${index}`,
            name: `Provider ${index}`,
            initials: "WP",
            status: "active",
          })
          .$returningId();
        for (let serviceIndex = 0; serviceIndex < 8; serviceIndex++)
          await service({ providerId: provider.id, priceAmount: "9.0000" });
      }
      const inr = await service({
        priceCurrency: "INR",
        priceAmount: "8.0000",
      });
      const item = await service({
        priceAmount: "0.0002",
        priceUnit: "per_item",
      });
      vi.spyOn(exchange, "getAssistantExchangeTable").mockResolvedValue({
        asOf: Date.now(),
        nextUpdate: Date.now() + 86400000,
        rates: { USD: "1", INR: "80" },
      });
      const plan: AssistantPlan = {
        action: "search",
        market: "smm",
        platform: "Instagram",
        category: "Followers",
        query: "",
        provider: null,
        countryCode: "WW",
        quantity: 1000,
        displayCurrency: "USD",
        budget: null,
        refillOnly: false,
        minRefillDays: null,
        preferLowest: true,
        serviceIds: [],
        reply: "Search",
      };
      const result = await assistantRankedSearch(plan);
      expect(result.candidates.slice(0, 3).map(c => c.service.id)).toEqual([
        `service-${inr}`,
        `service-${item}`,
        `service-${low}`,
      ]);
      expect(result.total).toBe(83);
      expect(
        (
          await assistantRankedSearch({ ...plan, budget: "0.15" })
        ).candidates.map(c => c.service.id)
      ).toEqual([`service-${inr}`]);
      const eligible = await service({
        refillMode: "automatic",
        refillDays: 30,
        priceAmount: "0.5000",
      });
      await service({
        refillMode: "automatic",
        refillDays: 7,
        priceAmount: "0.1000",
      });
      await service({
        refillMode: "automatic",
        refillDays: null,
        priceAmount: "0.1000",
      });
      expect(
        (
          await assistantRankedSearch({
            ...plan,
            refillOnly: true,
            minRefillDays: 30,
          })
        ).candidates.map(c => c.service.id)
      ).toEqual([`service-${eligible}`]);
    });
  });
}
