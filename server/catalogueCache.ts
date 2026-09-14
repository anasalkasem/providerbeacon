/** Bounded, short-lived cache. Concurrent identical requests share one SQL read. */
export class AsyncResultCache<T> {
  private entries = new Map<string, { promise: Promise<T>; expires: number }>();
  constructor(private ttlMs = 10_000, private maxEntries = 128, private now = Date.now) {}
  get size() { return this.entries.size; }
  clear() { this.entries.clear(); }
  get(key: string, load: () => Promise<T>, retain: (value: T) => boolean = () => true): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expires > this.now()) {
      this.entries.delete(key); this.entries.set(key, existing);
      return existing.promise;
    }
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const entry = { promise: undefined as unknown as Promise<T>, expires: Infinity };
    entry.promise = Promise.resolve().then(load).then(value => {
      if (this.entries.get(key) === entry) {
        // Each retained response is bounded too, not only the number of keys.
        if (retain(value) && Buffer.byteLength(JSON.stringify(value)) <= 128_000) entry.expires = this.now() + this.ttlMs;
        else this.entries.delete(key);
      }
      return value;
    }, error => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }
}
const invalidators = new Set<() => void>();
export function registerCatalogueCache(clear: () => void) { invalidators.add(clear); }
export function invalidateCatalogueCaches() { invalidators.forEach(clear => clear()); }
