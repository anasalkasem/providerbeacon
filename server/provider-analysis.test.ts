import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { TeamRole } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  role: "provider_reviewer" as TeamRole | null,
  provider: vi.fn(),
  services: vi.fn(),
  audit: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock("./authorization", async original => ({
  ...await original<typeof import("./authorization")>(),
  resolveTeamRole: async () => state.role,
}));
vi.mock("./adminCatalogueDb", async original => ({
  ...await original<typeof import("./adminCatalogueDb")>(),
  getProviderForAnalysis: state.provider,
  listAdminServices: state.services,
}));
vi.mock("./marketplaceDb", async original => ({
  ...await original<typeof import("./marketplaceDb")>(),
  writeAudit: state.audit,
  updateProviderStatus: state.updateStatus,
}));

import { adminRouter } from "./routers/admin";

const assessment = {
  riskLevel: "medium",
  confidence: 65,
  summary: "تستند المراجعة إلى عينة محدودة من الكتالوج.",
  signals: ["بعض الأسعار تحتاج إلى مراجعة."],
  recommendedAction: "manual_review",
};
const provider = { id: 7, name: "Example provider", status: "active" };
const sample = [{ id: 12, providerId: 7, name: "Example service", priceAmount: "1.25" }];
const caller = (authenticated = true) => adminRouter.createCaller({
  user: authenticated ? { id: 1, role: "user" } : null,
  req: {},
  res: {},
} as TrpcContext);
const modelResponse = (result: unknown = assessment) => new Response(JSON.stringify({
  status: "completed",
  output: [{
    type: "message",
    content: [{ type: "output_text", text: JSON.stringify(result) }],
  }],
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.role = "provider_reviewer";
  state.provider.mockResolvedValue(provider);
  state.services.mockResolvedValue({ items: sample, total: 1000, nextCursor: 12 });
  state.audit.mockResolvedValue(undefined);
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key-not-a-secret");
  vi.stubEnv("OPENAI_MODEL", "");
  vi.stubEnv("BEACON_AI_ENABLED", "true");
  vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
  vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
  vi.stubGlobal("fetch", vi.fn(async () => modelResponse()));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("provider analysis through the shared OpenAI connection", () => {
  it("works with only OPENAI_API_KEY and records a validated advisory assessment", async () => {
    const result = await caller().ai.analyzeProvider({ providerId: 7, locale: "ar" });
    expect(result).toEqual({ ...assessment, model: "gpt-5-mini" });
    expect(state.services).toHaveBeenCalledWith({ providerId: 7, limit: 25 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request?.headers).toMatchObject({ authorization: "Bearer test-openai-key-not-a-secret" });
    const body = JSON.parse(request!.body as string);
    expect(body).toMatchObject({
      model: "gpt-5-mini",
      store: false,
      text: { format: { name: "provider_risk_assessment", type: "json_schema", strict: true } },
    });
    expect(JSON.parse(body.input[0].content)).toEqual({
      requestedLocale: "ar", provider, catalogueTotal: 1000, sampledServices: sample,
    });
    expect(request!.body).not.toContain("test-openai-key-not-a-secret");
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 1, action: "ai.provider.analysis", entityId: "7",
      metadata: { riskLevel: "medium", confidence: 65, recommendedAction: "manual_review" },
    }));
    expect(state.updateStatus).not.toHaveBeenCalled();
  });

  it("uses the configured model consistently in the API, result and audit", async () => {
    vi.stubEnv("OPENAI_MODEL", " gpt-4.1-mini ");
    const result = await caller().ai.analyzeProvider({ providerId: 7 });
    expect(result.model).toBe("gpt-4.1-mini");
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(request!.body as string).model).toBe(result.model);
    expect(state.audit.mock.calls[0]![0].summary).toContain(result.model);
  });

  it.each(["missing_key", "disabled"])("handles %s with an actionable localized error", async mode => {
    if (mode === "missing_key") vi.stubEnv("OPENAI_API_KEY", " ");
    else vi.stubEnv("BEACON_AI_ENABLED", "false");
    await expect(caller().ai.analyzeProvider({ providerId: 7, locale: "ar" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "تحليل الذكاء الاصطناعي غير مفعّل. راجع إعدادات OpenAI في الخادم.",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("does not expose upstream errors or audit failed analyses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("private-upstream-detail", { status: 401 }));
    await expect(caller().ai.analyzeProvider({ providerId: 7, locale: "ar" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "تعذّر إكمال التحليل حاليًا. يرجى المحاولة مجددًا بعد قليل.",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.audit).not.toHaveBeenCalled();
  });

  it.each([
    { ...assessment, confidence: 101 },
    { ...assessment, signals: [] },
    { ...assessment, recommendedAction: "suspend_immediately" },
  ])("rejects invalid assessments before returning or auditing them", async invalid => {
    vi.mocked(fetch).mockResolvedValue(modelResponse(invalid));
    await expect(caller().ai.analyzeProvider({ providerId: 7 })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(state.audit).not.toHaveBeenCalled();
    expect(state.updateStatus).not.toHaveBeenCalled();
  });

  it("requires a session and provider-review permission before reading data or calling OpenAI", async () => {
    await expect(caller(false).ai.analyzeProvider({ providerId: 7 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    state.role = "catalogue_editor";
    await expect(caller().ai.analyzeProvider({ providerId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.provider).not.toHaveBeenCalled();
    expect(state.services).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("does not call OpenAI for a nonexistent provider", async () => {
    state.provider.mockResolvedValue(undefined);
    await expect(caller().ai.analyzeProvider({ providerId: 7 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });
});
