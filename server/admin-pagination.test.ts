import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { TeamRole } from "../drizzle/schema";

const state = vi.hoisted(() => ({ role: "catalogue_editor" as TeamRole | null,
  list: vi.fn(async () => ({ items: [], total: 0, nextCursor: null })), overview: vi.fn(async () => ({})) }));
vi.mock("./authorization", async original => ({ ...await original<any>(), resolveTeamRole: async () => state.role }));
vi.mock("./adminCatalogueDb", () => ({ listAdminServices: state.list, getAdminOverview: state.overview, getProviderForAnalysis: vi.fn() }));
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
    expect(catalogueInput.safeParse({ limit: 51 }).success).toBe(false);
    expect(catalogueInput.safeParse({ scope: "compare", ids: [1, 2, 3, 4, 5] }).success).toBe(false);
  });
});
