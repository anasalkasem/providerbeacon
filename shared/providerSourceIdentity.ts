// Host comparisons are attribution signals, not proof of provider ownership.
export function sourceHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.host.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

export function sourceMatchesWebsite(website: string | null | undefined, source: string | null | undefined): boolean | null {
  const websiteHost = sourceHost(website);
  const apiHost = sourceHost(source);
  if (!websiteHost || !apiHost) return null;
  return apiHost === websiteHost || apiHost.endsWith(`.${websiteHost}`);
}

export class CatalogueSourceConflict extends Error {
  constructor() { super("catalogue_source_conflict"); }
}

export function assertSameCatalogueSource(previous: string | null, next: string) {
  // Legacy records without a retained API source cannot establish a conflict.
  if (previous && (!sourceHost(previous) || sourceHost(previous) !== sourceHost(next))) {
    throw new CatalogueSourceConflict();
  }
}
