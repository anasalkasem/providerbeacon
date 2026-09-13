import { describe, expect, it } from "vitest";
import { hasPermission, rolePermissions } from "./authorization";

describe("ProviderBeacon role permissions", () => {
  it("grants every permission only to the owner", () => {
    expect(rolePermissions.owner.length).toBeGreaterThan(rolePermissions.operations_manager.length);
    expect(hasPermission("owner", "team.write")).toBe(true);
    expect(hasPermission("owner", "integrations.write")).toBe(true);
  });

  it("prevents administrators from changing ownership or team access", () => {
    expect(hasPermission("administrator", "team.write")).toBe(false);
    expect(hasPermission("administrator", "providers.write")).toBe(true);
  });

  it("keeps catalogue editors limited to provider reads and service editing", () => {
    expect(rolePermissions.catalogue_editor).toEqual(["providers.read", "services.read", "services.write"]);
    expect(hasPermission("catalogue_editor", "team.read")).toBe(false);
    expect(hasPermission("catalogue_editor", "providers.review")).toBe(false);
  });

  it("makes auditors read-only", () => {
    expect(hasPermission("auditor", "audit.read")).toBe(true);
    expect(rolePermissions.auditor.some(permission => permission.endsWith(".write"))).toBe(false);
  });

  it("denies all team permissions to ordinary users", () => {
    expect(hasPermission(null, "providers.read")).toBe(false);
  });
});
