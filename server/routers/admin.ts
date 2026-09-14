import { adminProvidersInput } from "../../shared/catalogueQuery";
import { createSourcedDrafts } from "../sourcedOffersDb";
import { sourcedBatchInput } from "../../shared/sourcedOffers";
import { listProviderSyncIssues } from "../providerSync";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import { hasPermission, resolveTeamRole, rolePermissions } from "../authorization";
import {
  acceptTeamInvite,
  createProviderDraft,
  createTeamInvite,
  listAdminProviders,
  listAdminProviderPage,
  listAuditEntries,
  listLocalizedContent,
  listTeamMembers,
  setTeamMemberStatus,
  setProviderCataloguePublication,
  updateProviderStatus,
  updateServiceRecord,
  upsertLocalizedContent,
  writeAudit,
} from "../marketplaceDb";
import { deleteProviderIntegration, listProviderIntegrations, saveProviderIntegration, setProviderIntegrationEnabled, syncStoredIntegration } from "../vaultDb";

import { getCachedAdminOverview, getProviderForAnalysis, getCachedServiceReviewSummary, listAdminServices, listSyncAlerts } from "../adminCatalogueDb";
import { adminServicesInput } from "../../shared/catalogueQuery";
import { reviewBatchInput, reviewEditInput } from "../../shared/serviceReview";
import { sourcePricingInput } from "../../shared/sourcePricing";
import { confirmSourcePricing } from "../sourcePricing";
import { applyServiceReview, editServiceReview, getServiceReview } from "../serviceReviewDb";

const teamRole = z.enum(["owner", "administrator", "operations_manager", "provider_reviewer", "catalogue_editor", "translation_manager", "auditor"]);

export const adminRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    const role = await resolveTeamRole(ctx.user!);
    return { role, permissions: role ? rolePermissions[role] : [], authMode: ctx.authMode ?? null };
  }),
  overview: protectedProcedure.query(async ({ ctx }) => {
    const role = await resolveTeamRole(ctx.user!);
    if (!role) throw new TRPCError({ code: "FORBIDDEN" });
    return getCachedAdminOverview(rolePermissions[role]);
  }),
  acceptInvite: protectedProcedure.input(z.object({ token: z.string().min(20).max(200) })).mutation(({ ctx, input }) => acceptTeamInvite({ token: input.token, userId: ctx.user!.id, email: ctx.user!.email })),
  providers: router({
    list: permissionProcedure("providers.read").input(adminProvidersInput).query(({ input }) => listAdminProviders(input)),
    page: permissionProcedure("providers.read").input(adminProvidersInput).query(({ input }) => listAdminProviderPage(input)),
    createDraft: permissionProcedure("providers.write").input(z.object({ name: z.string().trim().min(2).max(200), websiteUrl: z.string().url().max(500) })).mutation(({ ctx, input }) => createProviderDraft({ ...input, actorUserId: ctx.user!.id })),
    setStatus: permissionProcedure("providers.review").input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "pending_review", "active", "suspended"]) })).mutation(({ ctx, input }) => updateProviderStatus({ ...input, actorUserId: ctx.user!.id })),
    setCataloguePublication: permissionProcedure("providers.review")
      .input(z.object({ id: z.number().int().positive(), enabled: z.boolean(), reason: z.string().trim().min(8).max(1000) }))
      .mutation(({ ctx, input }) => {
        if (!hasPermission(ctx.teamRole, "services.publish")) throw new TRPCError({ code: "FORBIDDEN" });
        return setProviderCataloguePublication({ ...input, actorUserId: ctx.user!.id, ipAddress: ctx.req.ip });
      }),
  }),
  services: router({
    confirmSourcePricing: permissionProcedure("services.review").input(sourcePricingInput).mutation(({ctx,input}) => confirmSourcePricing({...input,actorUserId:ctx.user!.id,ipAddress:ctx.req.ip})),
    createSourcedDrafts: permissionProcedure("services.write").input(sourcedBatchInput).mutation(({ ctx, input }) => createSourcedDrafts({ ...input, actorUserId: ctx.user!.id, ipAddress: ctx.req.ip })),
    reviewSummary: permissionProcedure("services.read").input(adminServicesInput).query(({ input }) => getCachedServiceReviewSummary(input)),
    detail: permissionProcedure("services.read").input(z.object({ id: z.number().int().positive() })).query(({ input }) => getServiceReview(input.id)),
    editReview: permissionProcedure("services.write").input(reviewEditInput).mutation(({ ctx, input }) => editServiceReview({ ...input, actorUserId: ctx.user!.id, ipAddress: ctx.req.ip })),
    approve: permissionProcedure("services.review").input(reviewBatchInput).mutation(({ ctx, input }) => applyServiceReview({ ...input, action: "approve", actorUserId: ctx.user!.id, ipAddress: ctx.req.ip })),
    requestChanges: permissionProcedure("services.review").input(reviewBatchInput).mutation(({ ctx, input }) => applyServiceReview({ ...input, action: "request_changes", actorUserId: ctx.user!.id, ipAddress: ctx.req.ip })),
    publish: permissionProcedure("services.publish").input(reviewBatchInput).mutation(({ ctx, input }) => applyServiceReview({ ...input, action: "publish", actorUserId: ctx.user!.id, ipAddress: ctx.req.ip })),
    list: permissionProcedure("services.read").input(adminServicesInput).query(({ input }) => listAdminServices(input)),
    update: permissionProcedure("services.write").input(z.object({ id: z.number().int().positive(), status: z.enum(["draft", "active", "paused", "archived"]).optional(), priceAmount: z.number().positive().max(100000).optional() }).refine(value => value.status != null || value.priceAmount != null)).mutation(({ ctx, input }) => updateServiceRecord({ ...input, actorUserId: ctx.user!.id })),
  }),
  integrations: router({
    issues: permissionProcedure("integrations.read").input(z.object({ jobId: z.number().int().positive(), cursor: z.number().int().nonnegative().optional() })).query(({ input }) => listProviderSyncIssues(input)),
    alerts: permissionProcedure("integrations.read").query(() => listSyncAlerts()),
    list: permissionProcedure("integrations.read").query(() => listProviderIntegrations()),
    save: permissionProcedure("integrations.write").input(z.object({
      id: z.number().int().positive().optional(), providerId: z.number().int().positive(), name: z.string().trim().min(2).max(160),
      baseUrl: z.string().url().max(500), apiKey: z.string().min(8).max(500).optional(),
      syncIntervalMinutes: z.number().int().min(60).max(10080), enabled: z.boolean(),
    })).mutation(({ ctx, input }) => saveProviderIntegration({ ...input, actorUserId: ctx.user!.id })),
    setEnabled: permissionProcedure("integrations.write").input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(({ ctx, input }) => setProviderIntegrationEnabled({ ...input, actorUserId: ctx.user!.id })),
    syncNow: permissionProcedure("integrations.write").input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => syncStoredIntegration({ id: input.id, actorUserId: ctx.user!.id })),
    remove: permissionProcedure("integrations.write").input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteProviderIntegration({ id: input.id, actorUserId: ctx.user!.id })),
  }),
  team: router({
    list: permissionProcedure("team.read").query(() => listTeamMembers()),
    invite: permissionProcedure("team.write").input(z.object({ email: z.string().email().max(320), role: teamRole.exclude(["owner"]) })).mutation(({ ctx, input }) => createTeamInvite({ ...input, actorUserId: ctx.user!.id })),
    setStatus: permissionProcedure("team.write").input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "suspended"]) })).mutation(({ ctx, input }) => setTeamMemberStatus({ ...input, actorUserId: ctx.user!.id })),
  }),
  translations: router({
    list: permissionProcedure("translations.read").query(() => listLocalizedContent()),
    upsert: permissionProcedure("translations.write").input(z.object({ entityType: z.enum(["provider", "service", "page"]), entityId: z.string().min(1).max(160), fieldName: z.string().min(1).max(100), locale: z.enum(["en", "es", "ar", "hi", "zh"]), value: z.string().min(1).max(10000), status: z.enum(["draft", "machine_translated", "reviewed", "published"]) })).mutation(({ ctx, input }) => upsertLocalizedContent({ ...input, actorUserId: ctx.user!.id })),
  }),
  ai: router({
    analyzeProvider: permissionProcedure("providers.review").input(z.object({ providerId: z.number().int().positive(), locale: z.enum(["en", "es", "ar", "hi", "zh"]).default("en") })).mutation(async ({ ctx, input }) => {
      const provider = await getProviderForAnalysis(input.providerId);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const page = await listAdminServices({ providerId: provider.id, limit: 25 });
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [
        { role: "system", content: "You are a cautious marketplace risk analyst. Analyze only the supplied operational data. Do not invent external facts. Return a concise evidence-based assessment in the requested language. The service list is a bounded sample, not the full catalogue; explicitly state this limitation. AI output is advisory and must not automatically change provider status." },
        { role: "user", content: JSON.stringify({ requestedLocale: input.locale, provider, catalogueTotal: page.total, sampledServices: page.items }) },
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
