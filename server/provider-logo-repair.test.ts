import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as any[],
  current: null as any,
  fetch: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
  invalidate: vi.fn(),
  budget: vi.fn(),
}));
vi.mock("./linkMetadata", () => ({ fetchWebsiteLogo: state.fetch }));
vi.mock("./marketplaceDb", () => ({ writeAudit: state.audit }));
vi.mock("./catalogueCache", () => ({
  invalidateCatalogueCaches: state.invalidate,
}));
vi.mock("./memberDb", () => ({ reserveMemberRequests: state.budget }));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ orderBy: () => ({ limit: async () => state.rows }) }),
        }),
      }),
    }),
    transaction: async (run: any) =>
      run({
        select: () => ({
          from: () => ({
            where: () => ({
              for: async () => (state.current ? [state.current] : []),
            }),
          }),
        }),
        update: () => ({
          set: (value: unknown) => ({ where: async () => state.update(value) }),
        }),
      }),
  }),
}));
import {
  needsLogoRepair,
  repairImportedProviderLogos,
} from "./providerLogoRepair";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
  state.rows = [
    {
      id: 3,
      revision: 4,
      websiteUrl: "https://provider.com/",
      logoUrl:
        "https://providerbeacon.com/api/imported-media/" + "a".repeat(64),
      mime: "image/svg+xml",
      content: Buffer.from('<svg><rect fill="url(#missing)"/></svg>').toString(
        "base64"
      ),
    },
  ];
  state.current = { ...state.rows[0] };
  state.fetch.mockResolvedValue(
    "https://providerbeacon.com/api/imported-media/" + "b".repeat(64)
  );
  state.budget.mockResolvedValue(undefined);
});

describe("recovery of previously imported provider logos", () => {
  it("replaces a broken imported image, increments the profile revision and records the change", async () => {
    expect(await repairImportedProviderLogos()).toBe(1);
    expect(state.update).toHaveBeenCalledWith({
      logoUrl:
        "https://providerbeacon.com/api/imported-media/" + "b".repeat(64),
      profileRevision: 5,
    });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "provider.logo.repair",
        entityId: "3",
      }),
      expect.anything()
    );
    expect(state.invalidate).toHaveBeenCalledOnce();
  });
  it("preserves an operator's concurrent edit", async () => {
    state.current.revision = 5;
    state.current.logoUrl = "https://provider.com/manually-selected.png";
    expect(await repairImportedProviderLogos()).toBe(0);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });
  it("preserves the current image when recovery is unavailable", async () => {
    state.fetch.mockResolvedValue(null);
    expect(await repairImportedProviderLogos()).toBe(0);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("skips intact artwork and bounds attempts when the request budget is exhausted", async () => {
    expect(
      needsLogoRepair(
        "image/svg+xml",
        Buffer.from('<svg><path d="M0 0H20V20Z"/></svg>').toString("base64")
      )
    ).toBe(false);
    expect(needsLogoRepair("image/png", "")).toBe(false);
    state.budget.mockRejectedValue(new Error("limit"));
    expect(await repairImportedProviderLogos()).toBe(0);
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
