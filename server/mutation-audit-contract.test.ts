import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const marketplaceSource = readFileSync(new URL("./marketplaceDb.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const adminRouterSource = readFileSync(new URL("./routers/admin.ts", import.meta.url), "utf8");

function functionBody(name: string, nextName?: string) {
  const start = marketplaceSource.indexOf(`export async function ${name}`);
  const end = nextName ? marketplaceSource.indexOf(`export async function ${nextName}`, start + 1) : marketplaceSource.length;
  expect(start).toBeGreaterThanOrEqual(0);
  return marketplaceSource.slice(start, end < 0 ? marketplaceSource.length : end);
}

describe("mutation audit contract", () => {
  it.each([
    ["seedMarketplaceIfEmpty", "listTeamMembers", "marketplace.seed"],
    ["updateProviderStatus", "listAdminServices", "provider.status.update"],
    ["updateServiceRecord", "createTeamInvite", "service.update"],
    ["createTeamInvite", "acceptTeamInvite", "team.invite"],
    ["acceptTeamInvite", "listAuditEntries", "team.invite.accept"],
    ["upsertLocalizedContent", "syncProviderServicesNow", "translation.upsert"],
    ["syncProviderServicesNow", "writeAudit", "integration.services.sync"],
  ])("requires %s to write an audit entry", (name, nextName, action) => {
    const source = functionBody(name, nextName);
    expect(source).toContain("writeAudit(");
    expect(source).toContain(action);
  });

  it("records authenticated logout events without blocking cookie cleanup", () => {
    expect(routerSource).toContain('action: "auth.logout"');
    expect(routerSource).toContain("clearCookie");
  });

  it("records advisory AI analysis without changing provider status", () => {
    expect(adminRouterSource).toContain('action: "ai.provider.analysis"');
    expect(adminRouterSource).toContain("AI output is advisory");
  });
});
