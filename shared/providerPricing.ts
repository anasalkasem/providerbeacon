export type ProviderPricingSnapshot = {
  currency: string | null;
  perThousandEvidenceUrl: string | null;
  // Public table evidence is bound to both the service ID and its name.
  // Hashes keep job snapshots small and exclude unrelated page content.
  perThousandRows?: { url: string; names: Record<string, string> };
};
