import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { TeamRole } from "../drizzle/schema";

const state = vi.hoisted(() => ({ role: "catalogue_editor" as TeamRole | null,
  list: vi.fn(async () => ({ items: [], total: 0, nextCursor: null })), overview: vi.fn(async () => ({})), reviewSummary: vi.fn(async () => ({ total: 0 })) }));
vi.mock("./authorization", async original => ({ ...await original<any>(), resolveTeamRole: async () => state.role }));
vi.mock("./adminCatalogueDb", () => ({ listAdminServices: state.list, getCachedAdminOverview: state.overview, getCachedServiceReviewSummary: state.reviewSummary, getProviderForAnalysis: vi.fn(), listSyncAlerts: vi.fn() }));
import { adminRouter } from "./routers/admin";
import { catalogueInput } from "../shared/catalogueQuery";

const caller = (authenticated = true) => adminRouter.createCaller({ user: authenticated ? { id: 1, role: "user" } : null, req: {}, res: {} } as TrpcContext);
beforeEach(() => { state.role = "catalogue_editor"; vi.clearAllMocks(); });

describe("bounded administrative queries", () => {
  it("uses a small default even if a client omits the pagination input", async () => {
    await caller().services.list(); expect(state.list).toHaveBeenCalledWith({ limit: 25, q: "" });
  });
  it("rejects oversized, negative and malformed requests before querying the database", async () => {
    for (const input of [{ limit: 101 }, { limit: 0 }, { cursor: -1 }, { q: "x".repeat(101) }]) {
      await expect(caller().services.list(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(state.list).not.toHaveBeenCalled();
  });
  it("requires a session and server permission on both list and overview", async () => {
    await expect(caller(false).services.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    state.role = null;
    await expect(caller().services.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.list).not.toHaveBeenCalled(); expect(state.overview).not.toHaveBeenCalled();
  });
  it("passes only the caller's permitted aggregates to the overview", async () => {
    await caller().overview();
    expect(state.overview).toHaveBeenCalledWith(["providers.read", "services.read", "services.write"]);
  });
  it("caps public pages and explicit comparisons independently", () => {
    expect(catalogueInput.safeParse({ limit: 101 }).success).toBe(false);
    expect(catalogueInput.safeParse({ scope: "compare", ids: [1, 2, 3, 4, 5] }).success).toBe(false);
  });
  it("validates review needs and summary filters before running database queries", async () => {
    await caller().services.list({ need: "pricing_unconfirmed" });
    expect(state.list).toHaveBeenCalledWith({ limit: 25, q: "", need: "pricing_unconfirmed" });
    await expect(caller().services.list({ need: "invented" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().services.reviewSummary({ q: "x".repeat(101) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.reviewSummary).not.toHaveBeenCalled();
  });
  it("requires service-read permission for review summary counts", async () => {
    await expect(caller(false).services.reviewSummary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    state.role = null;
    await expect(caller().services.reviewSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.reviewSummary).not.toHaveBeenCalled();
    state.role = "catalogue_editor";
    await caller().services.reviewSummary({ q: "Website", view: "changes_requested" });
    expect(state.reviewSummary).toHaveBeenCalledWith({ limit: 25, q: "Website", view: "changes_requested" });
  });
});


describe("review permissions at the API boundary", () => {
  const batch = { items: [{ id: 1, revision: 1 }], reason: "Checked the source" };
  it("requires authentication and both provider review and service publication permission for an API catalogue", async () => {
    const request = { id: 1, enabled: true, reason: "Publish the connected provider" };
    await expect(caller(false).providers.setCataloguePublication(request)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    for (const role of ["catalogue_editor", "provider_reviewer", "translation_manager", "auditor"] as const) {
      state.role = role;
      await expect(caller().providers.setCataloguePublication(request)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("does not let editors approve or publish, or auditors request changes", async () => {
    await expect(caller().services.approve(batch)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().services.publish(batch)).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.role = "auditor";
    await expect(caller().services.requestChanges(batch)).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.role = "provider_reviewer";
    await expect(caller().services.publish(batch)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("requires a session for every review mutation", async () => {
    for (const action of ["approve", "requestChanges", "publish"] as const) await expect(caller(false).services[action](batch)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
