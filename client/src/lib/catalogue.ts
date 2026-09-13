import type { Provider, Service } from "@/data/marketplace";

export function catalogueIndex(providers: Provider[], inputServices: Service[]) {
  const providersById = new Map(providers.map(provider => [provider.id, provider]));
  const counts = new Map<string, number>();
  for (const service of inputServices) counts.set(service.id, (counts.get(service.id) ?? 0) + 1);
  // Never attribute an orphan offer to another provider or resolve ambiguous IDs.
  const services = inputServices.filter(service => providersById.has(service.providerId) && counts.get(service.id) === 1);
  const servicesById = new Map(services.map(service => [service.id, service]));
  return {
    providers, services,
    providerFor(service: Service) {
      const provider = providersById.get(service.providerId);
      if (!provider) throw new Error("Service provider is not in the current catalogue");
      return provider;
    },
    providerBySlug: (slug: string) => providers.find(provider => provider.slug === slug),
    serviceFor: (id: string) => servicesById.get(id),
  };
}

export function comparisonSelection(ids: string | null, serviceFor: (id: string) => Service | undefined) {
  const requested = Array.from(new Set((ids ?? "").split(",").filter(Boolean))).slice(0, 4);
  const selected = requested.map(serviceFor).filter((service): service is Service => Boolean(service));
  return { selected, missing: requested.length !== selected.length };
}
