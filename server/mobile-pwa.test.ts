import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";

const origin = "https://providerbeacon.com";
function worker() {
  const handlers = new Map<string, (event: any) => void>();
  const fallback = new Response("offline recovery");
  const cache = {
    addAll: vi.fn(async () => {}),
    match: vi.fn(async () => fallback),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [
      "providerbeacon-offline-previous",
      "another-app-cache",
      "providerbeacon-offline-test",
    ]),
    delete: vi.fn(async () => true),
  };
  const fetch = vi.fn(async (_request: any) => new Response("fresh network"));
  const self = {
    location: { origin },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (name: string, handler: any) =>
      handlers.set(name, handler),
  };
  runInNewContext(
    readFileSync("client/sw.js", "utf8").replaceAll("__BUILD_ID__", "test"),
    { self, caches, fetch, URL, Response }
  );
  async function dispatch(name: string, input: Record<string, unknown> = {}) {
    let response: Promise<Response> | undefined,
      done: Promise<unknown> | undefined;
    handlers.get(name)?.({
      ...input,
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
      waitUntil: (value: Promise<unknown>) => {
        done = value;
      },
    });
    await done;
    return response;
  }
  return { dispatch, fetch, caches, cache, self };
}
describe("mobile app service worker", () => {
  it("installs only the small public offline document and waits for update approval", async () => {
    const w = worker();
    await w.dispatch("install");
    expect(w.cache.addAll).toHaveBeenCalledWith([
      "/offline.html",
      "/offline.js",
      "/icon-192.png?v=pb1",
    ]);
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
  });
  it("keeps prices, authenticated API results, writes and third-party traffic outside its cache", async () => {
    const w = worker();
    for (const request of [
      {
        method: "GET",
        mode: "cors",
        url: `${origin}/api/trpc/workspace.dashboard?input=private`,
      },
      {
        method: "GET",
        mode: "cors",
        url: `${origin}/api/trpc/catalogue.search`,
      },
      {
        method: "POST",
        mode: "cors",
        url: `${origin}/api/trpc/assistant.chat`,
      },
      {
        method: "GET",
        mode: "navigate",
        url: "https://accounts.google.com/authorize",
      },
      { method: "GET", mode: "cors", url: `${origin}/assets/account.js` },
    ])
      expect(await w.dispatch("fetch", { request })).toBeUndefined();
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
  });
  it("always fetches account HTML fresh and only falls back when offline", async () => {
    const w = worker();
    const request = {
      method: "GET",
      mode: "navigate",
      url: `${origin}/account`,
    };
    expect(await (await w.dispatch("fetch", { request }))?.text()).toBe(
      "fresh network"
    );
    expect(w.caches.open).not.toHaveBeenCalled();
    w.fetch.mockRejectedValueOnce(new TypeError("Offline"));
    expect(await (await w.dispatch("fetch", { request }))?.text()).toBe(
      "offline recovery"
    );
    expect(w.cache.match).toHaveBeenCalledWith("/offline.html");
  });
  it("serves recovery assets from cache and cleans only its own older revisions", async () => {
    const w = worker();
    await w.dispatch("fetch", {
      request: { method: "GET", mode: "cors", url: `${origin}/offline.js` },
    });
    expect(w.fetch).not.toHaveBeenCalled();
    await w.dispatch("activate");
    expect(w.caches.delete).toHaveBeenCalledOnce();
    expect(w.caches.delete).toHaveBeenCalledWith(
      "providerbeacon-offline-previous"
    );
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
    await w.dispatch("message", { data: { type: "UNKNOWN" } });
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    await w.dispatch("message", { data: { type: "ACTIVATE_UPDATE" } });
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it("has a stable identity, task-first entry and valid local icons/shortcuts", () => {
    const manifest = JSON.parse(
      readFileSync("client/public/manifest.json", "utf8")
    );
    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.start_url).toBe("/find?source=pwa");
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) {
      const bytes = readFileSync(
        `client/public${new URL(icon.src, origin).pathname}`
      );
      const size = Number(icon.sizes.split("x")[0]);
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    }
    expect(
      manifest.shortcuts.map(
        (s: { url: string }) => new URL(s.url, origin).pathname
      )
    ).toEqual(["/find", "/account", "/compare"]);
  });
});
