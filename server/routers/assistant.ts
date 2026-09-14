import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { assistantTurnInput } from "../../shared/assistant";
import { priceCurrencies } from "../../shared/pricing";
import { runAssistantTurn } from "../assistant";
import { assistantAvailable } from "../assistantModel";
import {
  assertAssistantOrigin,
  assistantClientKey,
  enterAssistant,
  reserveAssistantTurn,
} from "../assistantUsage";
import {
  assistantOffersByIds,
  quoteAssistantOffers,
} from "../assistantCatalogue";
import { getAssistantExchangeTable } from "../assistantExchange";
import { AsyncResultCache, registerCatalogueCache } from "../catalogueCache";
import { publicProcedure, router } from "../_core/trpc";

const quoteInput = z
  .object({
    serviceIds: z
      .array(z.string().regex(/^service-[1-9]\d{0,9}$/))
      .min(1)
      .max(4),
    quantity: z.number().int().min(1).max(2147483647),
    currency: z.enum(priceCurrencies),
  })
  .strict();

export async function getAssistantQuotes(input: z.infer<typeof quoteInput>) {
  const ids = Array.from(new Set(input.serviceIds));
  const candidates = await assistantOffersByIds(ids);
  const needsFx = candidates.some(
    ({ service }) =>
      service.priceCurrency &&
      service.priceCurrency !== input.currency &&
      service.priceUnit &&
      service.priceUnit !== "package"
  );
  const fx = needsFx ? await getAssistantExchangeTable() : null;
  const quotes = quoteAssistantOffers(
    candidates,
    input.quantity,
    input.currency,
    fx
  );
  const comparable =
    candidates.length === ids.length &&
    candidates.length > 1 &&
    !!quotes[0]?.group &&
    quotes.every(
      quote => quote.group === quotes[0]!.group && quote.comparableTotal != null
    );
  return {
    comparable,
    currency: input.currency,
    offers: quotes.map(({ offer }) => ({
      id: offer.service.id,
      total: offer.total,
      convertedTotal: offer.convertedTotal,
      fxAsOf: offer.fxAsOf,
      lowest: comparable && offer.lowest,
    })),
  };
}
const quotesCache = new AsyncResultCache<
  Awaited<ReturnType<typeof getAssistantQuotes>>
>(10000, 128);
registerCatalogueCache(() => quotesCache.clear());

export const assistantRouter = router({
  status: publicProcedure.query(() => ({ available: assistantAvailable() })),
  quotes: publicProcedure.input(quoteInput).query(async ({ input }) => {
    try {
      return await quotesCache.get(JSON.stringify(input), () =>
        getAssistantQuotes(input)
      );
    } catch {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "AI_CATALOGUE_UNAVAILABLE",
      });
    }
  }),
  chat: publicProcedure
    .input(assistantTurnInput)
    .mutation(async ({ input, ctx }) => {
      assertAssistantOrigin(ctx.req);
      if (!assistantAvailable())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI_NOT_CONFIGURED",
        });
      const release = enterAssistant();
      try {
        await reserveAssistantTurn(assistantClientKey(ctx.req));
        return await runAssistantTurn(input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "AI_UNAVAILABLE",
        });
      } finally {
        release();
      }
    }),
});
