// Tombstones for the original fictional identities. Never use as provider data.
export const retiredDemoSlugs = [
  "northstar-social", "pulse-media-lab", "sociaflow", "apex-smm",
  "hyperviral-cloud", "peak-engagement", "smmboost-pro", "orbit-reach",
] as const;

export function assertRealProviderSlug(slug: string) {
  if ((retiredDemoSlugs as readonly string[]).includes(slug.toLowerCase()))
    throw new Error("Retired demo identities cannot be created or published");
}
