import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// vite-plugin-pwa injects the precache manifest here at build time.
precacheAndRoute(self.__WB_MANIFEST);

// Silent auto-update: without these two calls, a newly-installed service
// worker sits in the background "waiting" state until every tab with this
// app open is fully closed (the standard SW lifecycle default) — which is
// exactly why a real deploy can go live on the server while a returning
// user, or even a freshly-refreshed tab, keeps seeing the old cached
// version indefinitely. skipWaiting() lets a new worker activate the
// moment it finishes installing instead of waiting; clientsClaim() then
// hands it control of every already-open tab immediately, rather than
// only new ones. main.jsx pairs this with a one-time reload on
// controllerchange so an already-open tab actually picks up the new JS
// bundle, not just a new worker controlling stale in-memory code.
self.skipWaiting();
clientsClaim();

self.addEventListener("push", (event) => {
  let data = { title: "OpenBook", body: "You have a reminder.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
