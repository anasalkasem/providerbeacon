import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const marketplaceSource = readFileSync(new URL("./marketplaceDb.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./authDb.ts", import.meta.url), "utf8");
const vaultSource = readFileSync(new URL("./vaultDb.ts", import.meta.url), "utf8");
const authRouterSource = readFileSync(new URL("./routers/auth.ts", import.meta.url), "utf8");
const adminRouterSource = readFileSync(new URL("./routers/admin.ts", import.meta.url), "utf8");

function functionBody(sourceText: string, name: string, nextName?: string) {
  const start = sourceText.indexOf(`export async function ${name}`);
  const end = nextName ? sourceText.indexOf(`export async function ${nextName}`, start + 1) : sourceText.length;
  expect(start).toBeGreaterThanOrEqual(0);
  return sourceText.slice(start, end < 0 ? sourceText.length : end);
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
    const source = functionBody(marketplaceSource, name, nextName);
    expect(source).toContain("writeAudit(");
    expect(source).toContain(action);
  });

  it.each([
    ["bootstrapOwner", "recoverBootstrapOwner", "auth.owner.bootstrap"],
    ["recoverBootstrapOwner", "registerInvitedAccount", "auth.owner.recover"],
    ["registerInvitedAccount", "loginWithPassword", "auth.invite.register"],
    ["changePassword", "beginMfaSetup", "auth.password.change"],
    ["confirmMfaSetup", "revokeOtherSessions", "auth.mfa.enable"],
    ["revokeOtherSessions", undefined, "auth.sessions.revoke"],
  ])("requires %s to write an authentication audit entry", (name, nextName, action) => {
    const source = functionBody(authSource, name, nextName);
    expect(source).toContain("writeAuthAudit(");
    expect(source).toContain(action);
  });

  it.each([
    ["saveProviderIntegration", "setProviderIntegrationEnabled", "integration.vault"],
    ["setProviderIntegrationEnabled", "syncStoredIntegration", "integration.schedule.toggle"],
    ["syncStoredIntegration", "runDueProviderSyncs", "integration.schedule"],
  ])("requires %s to write a vault audit entry", (name, nextName, action) => {
    const source = functionBody(vaultSource, name, nextName);
    expect(source).toContain("writeAudit(");
    expect(source).toContain(action);
  });

  it("clears both authentication cookies on logout", () => {
    expect(authRouterSource).toContain("clearCookie(STAFF_SESSION_COOKIE");
    expect(authRouterSource).toContain("clearCookie(COOKIE_NAME");
  });

  it("records advisory AI analysis without changing provider status", () => {
    expect(adminRouterSource).toContain('action: "ai.provider.analysis"');
    expect(adminRouterSource).toContain("AI output is advisory");
  });
});
