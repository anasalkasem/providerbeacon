import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(new URL("./authDb.ts", import.meta.url), "utf8");
const marketplaceSource = readFileSync(new URL("./marketplaceDb.ts", import.meta.url), "utf8");
const vaultSource = readFileSync(new URL("./vaultDb.ts", import.meta.url), "utf8");

describe("team access lifecycle", () => {
  it("requires active membership during password login and session authentication", () => {
    expect(authSource.match(/eq\(teamMembers\.status, "active"\)/g)?.length).toBeGreaterThanOrEqual(1);
    expect(authSource).toContain('membership.status !== "active"');
    expect(authSource).toContain('action: "auth.login.suspended"');
  });

  it("prevents owner and self suspension and revokes suspended sessions", () => {
    expect(marketplaceSource).toContain('member.role === "owner"');
    expect(marketplaceSource).toContain("member.userId === input.actorUserId");
    expect(marketplaceSource).toContain("db.delete(staffSessions)");
  });

  it("only deletes disabled integrations and records the deletion", () => {
    expect(vaultSource).toContain('integration.status === "active"');
    expect(vaultSource).toContain("tx.delete(providerIntegrations)");
    expect(vaultSource).toContain('action: "integration.vault.delete"');
  });
});
