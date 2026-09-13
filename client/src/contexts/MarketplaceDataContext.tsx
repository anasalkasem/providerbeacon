import { providerBySlug as fallbackProviderBySlug, providerFor as fallbackProviderFor, providers as fallbackProviders, services as fallbackServices, type Provider, type Service } from "@/data/marketplace";
import { trpc } from "@/lib/trpc";
import { createContext, useContext, useMemo, type ReactNode } from "react";

type MarketplaceData = {
  providers: Provider[];
  services: Service[];
  source: "database" | "seed" | "fallback";
  providerFor: (service: Service) => Provider;
  providerBySlug: (slug: string) => Provider | undefined;
  serviceFor: (id: string) => Service | undefined;
  isLoading: boolean;
};

const fallback: MarketplaceData = { providers: fallbackProviders, services: fallbackServices, source: "fallback", providerFor: fallbackProviderFor, providerBySlug: fallbackProviderBySlug, serviceFor: id => fallbackServices.find(service => service.id === id), isLoading: false };
const runtimeFallbackProviders = import.meta.env.PROD ? [] : fallbackProviders;
const runtimeFallbackServices = import.meta.env.PROD ? [] : fallbackServices;
const MarketplaceDataContext = createContext<MarketplaceData>(fallback);

export function MarketplaceDataProvider({ children }: { children: ReactNode }) {
  const query = trpc.marketplace.snapshot.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 1 });
  const value = useMemo<MarketplaceData>(() => {
    const providers = (query.data?.providers ?? runtimeFallbackProviders) as Provider[];
    const services = (query.data?.services ?? runtimeFallbackServices) as Service[];
    const providersById = new Map(providers.map(provider => [provider.id, provider]));
    return {
      providers,
      services,
      source: query.data?.source ?? "fallback",
      providerFor: service => providersById.get(service.providerId) ?? fallbackProviderFor(service),
      providerBySlug: slug => providers.find(provider => provider.slug === slug),
      serviceFor: id => services.find(service => service.id === id),
      isLoading: query.isLoading,
    };
  }, [query.data, query.isLoading]);
  return <MarketplaceDataContext.Provider value={value}>{children}</MarketplaceDataContext.Provider>;
}

export function useMarketplaceData() { return useContext(MarketplaceDataContext); }
