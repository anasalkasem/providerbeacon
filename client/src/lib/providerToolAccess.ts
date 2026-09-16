import { planState } from "../../../shared/providerBusiness";

export const premiumProviderSections = [
  "analytics",
  "vip",
  "groups",
  "offers",
] as const;
export type PremiumProviderSection = (typeof premiumProviderSections)[number];
export type ProviderToolAccess =
  | ReturnType<typeof planState>
  | "email"
  | "ownership";

export function isPremiumProviderSection(
  section: string
): section is PremiumProviderSection {
  return premiumProviderSections.some(value => value === section);
}

// A complimentary advertising placement is deliberately not a plan entitlement.
// The server remains authoritative for ownership, reads and mutations.
export function providerToolAccess(
  owned:
    | { ownershipValid: boolean; subscription: Parameters<typeof planState>[0] }
    | undefined,
  emailVerified: boolean,
  now: number
): ProviderToolAccess {
  if (!emailVerified) return "email";
  if (!owned?.ownershipValid) return "ownership";
  return planState(owned.subscription, now);
}
