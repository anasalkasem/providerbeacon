/* Only the offline recovery document is cached. Live data and account pages
   always go to the network, including authenticated GET requests. */
const CACHE_NAME = "providerbeacon-offline-__BUILD_ID__";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [
  OFFLINE_URL,
  "/offline.js",
  "/icon-192.png?v=lighthouse-1",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  );
  // Updates wait until the user requests them, or all existing tabs are closed.
});
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            name =>
              name.startsWith("providerbeacon-offline-") && name !== CACHE_NAME
          )
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});
self.addEventListener("message", event => {
  if (event.data?.type === "PUSH_CAPABILITY")
    event.ports?.[0]?.postMessage({ push: true });
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(OFFLINE_URL)) ?? Response.error();
        }
      })()
    );
  } else if (OFFLINE_ASSETS.includes(url.pathname + url.search)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ?? fetch(request);
      })()
    );
  }
});

function pushDestination(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (
      url.origin === self.location.origin &&
      ["/", "/admin"].includes(url.pathname)
    )
      return url.href;
  } catch {}
  return self.location.origin + "/";
}
self.addEventListener("push", event => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data?.json() ?? {};
      } catch {}
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await self.registration.showNotification("ProviderBeacon", {
        body:
          typeof data.body === "string"
            ? data.body.slice(0, 240)
            : "You have a new message. Open ProviderBeacon to read it.",
        icon: "/icon-192.png?v=lighthouse-1",
        badge: "/favicon-32x32.png?v=lighthouse-1",
        tag:
          data.tag === "providerbeacon-test"
            ? data.tag
            : "providerbeacon-messages",
        renotify: false,
        silent: windows.some(client => client.visibilityState === "visible"),
        data: { url: pushDestination(data.url) },
      });
    })()
  );
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = pushDestination(event.notification.data?.url);
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find(
        item => new URL(item.url).origin === self.location.origin
      );
      if (client) {
        const navigated = await client.navigate(url);
        if (navigated) return navigated.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
