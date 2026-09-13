import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { resolveTeamRole, rolePermissions } from "../authorization";
import { acceptTeamInvite, createTeamInvite, listAdminProviders, listAdminServices, listAuditEntries, listLocalizedContent, listTeamMembers, seedMarketplaceIfEmpty, syncProviderServicesNow, updateProviderStatus, updateServiceRecord, upsertLocalizedContent, writeAudit } from "../marketplaceDb";

const teamRole = z.enum(["owner", "administrator", "operations_manager", "provider_reviewer", "catalogue_editor", "translation_manager", "auditor"]);

export const adminRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    const role = await resolveTeamRole(ctx.user!);
    return { role, permissions: role ? rolePermissions[role] : [] };
  }),
  acceptInvite: protectedProcedure.input(z.object({ token: z.string().min(20).max(200) })).mutation(({ ctx, input }) => acceptTeamInvite({ token: input.token, userId: ctx.user!.id, email: ctx.user!.email })),
  seedMarketplace: permissionProcedure("providers.write").mutation(({ ctx }) => seedMarketplaceIfEmpty(ctx.user!.id)),
  providers: router({
    list: permissionProcedure("providers.read").query(() => listAdminProviders()),
    setStatus: permissionProcedure("providers.review").input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "pending_review", "active", "suspended"]) })).mutation(({ ctx, input }) => updateProviderStatus({ ...input, actorUserId: ctx.user!.id })),
  }),
  services: router({
    list: permissionProcedure("services.read").query(() => listAdminServices()),
    update: permissionProcedure("services.write").input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "active", "paused", "archived"]).optional(), pricePerThousandUsd: z.number().positive().max(100000).optional() }).refine(value => value.status != null || value.pricePerThousandUsd != null)).mutation(({ ctx, input }) => updateServiceRecord({ ...input, actorUserId: ctx.user!.id })),
  }),
  integrations: router({
    syncNow: permissionProcedure("integrations.write").input(z.object({ providerId: z.number().int().positive(), baseUrl: z.string().url().max(500), apiKey: z.string().min(8).max(500) })).mutation(({ ctx, input }) => syncProviderServicesNow({ ...input, actorUserId: ctx.user!.id })),
  }),
  team: router({
    list: permissionProcedure("team.read").query(() => listTeamMembers()),
    invite: permissionProcedure("team.write").input(z.object({ email: z.string().email().max(320), role: teamRole.exclude(["owner"]) })).mutation(({ ctx, input }) => createTeamInvite({ ...input, actorUserId: ctx.user!.id })),
  }),
  translations: router({
    list: permissionProcedure("translations.read").query(() => listLocalizedContent()),
    upsert: permissionProcedure("translations.write").input(z.object({ entityType: z.enum(["provider", "service", "page"]), entityId: z.string().min(1).max(160), fieldName: z.string().min(1).max(100), locale: z.enum(["en", "es", "ar", "hi", "zh"]), value: z.string().min(1).max(10000), status: z.enum(["draft", "machine_translated", "reviewed", "published"]) })).mutation(({ ctx, input }) => upsertLocalizedContent({ ...input, actorUserId: ctx.user!.id })),
  }),
  ai: router({
    analyzeProvider: permissionProcedure("providers.review").input(z.object({ providerId: z.number().int().positive(), locale: z.enum(["en", "es", "ar", "hi", "zh"]).default("en") })).mutation(async ({ ctx, input }) => {
      const provider = (await listAdminProviders()).find(item => item.id === input.providerId);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const services = (await listAdminServices()).filter(item => item.providerId === provider.id);
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: "You are a cautious marketplace risk analyst. Analyze only the supplied operational data. Do not invent external facts. Return a concise evidence-based assessment in the requested language. AI output is advisory and must not automatically change provider status." },
        { role: "user", content: JSON.stringify({ requestedLocale: input.locale, provider, services }) },
      ], response_format: { type: "json_schema", json_schema: { name: "provider_risk_assessment", strict: true, schema: { type: "object", properties: { riskLevel: { type: "string", enum: ["low", "medium", "high"] }, confidence: { type: "integer", minimum: 0, maximum: 100 }, summary: { type: "string" }, signals: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 }, recommendedAction: { type: "string", enum: ["keep_active", "manual_review", "consider_suspension"] } }, required: ["riskLevel", "confidence", "summary", "signals", "recommendedAction"], additionalProperties: false } } } });
      const content = response.choices[0]?.message.content;
      if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI analysis returned an unexpected response" });
      const assessment = JSON.parse(content) as { riskLevel: "low" | "medium" | "high"; confidence: number; summary: string; signals: string[]; recommendedAction: "keep_active" | "manual_review" | "consider_suspension" };
      await writeAudit({ actorUserId: ctx.user!.id, action: "ai.provider.analysis", entityType: "provider", entityId: String(provider.id), summary: `Generated advisory provider analysis using ${response.model}`, metadata: { riskLevel: assessment.riskLevel, confidence: assessment.confidence, recommendedAction: assessment.recommendedAction } });
      return { ...assessment, model: response.model };
    }),
  }),
  audit: router({
    list: permissionProcedure("audit.read").input(z.object({ limit: z.number().int().min(1).max(250).default(100) }).optional()).query(({ input }) => listAuditEntries(input?.limit ?? 100)),
  }),
});
