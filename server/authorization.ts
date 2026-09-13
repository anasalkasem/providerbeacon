import { and, eq, or } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { teamMembers, type TeamRole } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

export type Permission =
  | "providers.read" | "providers.write" | "providers.review"
  | "services.read" | "services.write" | "services.review" | "services.publish"
  | "team.read" | "team.write"
  | "translations.read" | "translations.write"
  | "audit.read"
  | "integrations.read" | "integrations.write";

const allPermissions: Permission[] = [
  "providers.read", "providers.write", "providers.review", "services.read", "services.write", "services.review", "services.publish",
  "team.read", "team.write", "translations.read", "translations.write", "audit.read",
  "integrations.read", "integrations.write",
];

export const rolePermissions: Record<TeamRole, Permission[]> = {
  owner: allPermissions,
  administrator: allPermissions.filter(permission => permission !== "team.write"),
  operations_manager: ["providers.read", "providers.write", "providers.review", "services.read", "services.write", "services.review", "services.publish", "translations.read", "audit.read", "integrations.read"],
  provider_reviewer: ["providers.read", "providers.review", "services.read", "services.review", "audit.read"],
  catalogue_editor: ["providers.read", "services.read", "services.write"],
  translation_manager: ["providers.read", "services.read", "translations.read", "translations.write"],
  auditor: ["providers.read", "services.read", "translations.read", "audit.read", "integrations.read"],
};

export async function resolveTeamRole(user: User): Promise<TeamRole | null> {
  if (user.openId === ENV.ownerOpenId) return "owner";
  const db = await getDb();
  if (!db) return user.role === "admin" ? "administrator" : null;
  const identity = user.email
    ? or(eq(teamMembers.userId, user.id), eq(teamMembers.email, user.email))
    : eq(teamMembers.userId, user.id);
  const [membership] = await db.select().from(teamMembers).where(and(identity, eq(teamMembers.status, "active"))).limit(1);
  if (membership) return membership.role;
  return user.role === "admin" ? "administrator" : null;
}

export function hasPermission(role: TeamRole | null, permission: Permission) {
  return Boolean(role && rolePermissions[role].includes(permission));
}
