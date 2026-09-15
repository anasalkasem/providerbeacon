import { z } from "zod";
import { memberLocale } from "./memberAuth";

export const assignableTeamRoles = [
  "administrator",
  "operations_manager",
  "provider_reviewer",
  "catalogue_editor",
  "translation_manager",
  "auditor",
] as const;
export const teamInviteInput = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform(value => value.toLowerCase()),
    role: z.enum(assignableTeamRoles),
    locale: memberLocale.default("en"),
  })
  .strict();
export const teamChangeInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
  })
  .strict();
export function inviteTokenFromLocation(search: string, hash: string) {
  // Existing query links remain usable; new links keep the secret out of request logs.
  return (
    new URLSearchParams(hash.replace(/^#/, "")).get("token") ??
    new URLSearchParams(search).get("token") ??
    ""
  );
}
