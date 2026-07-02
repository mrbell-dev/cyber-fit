/// <reference lib="webworker" />
// Custom service worker: Workbox precache (offline-first, same behavior as the
// old generateSW build) + web-push display. Payloads arrive E2E-encrypted;
// a generic fallback renders even if a push comes with no payload.
declare const self: ServiceWorkerGlobalScope;

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let title = "cyber-fit";
  let body = "Time to sync.";
  try {
    const data = event.data?.json();
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
  } catch {
    // generic fallback
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "cyber-fit-ping", // collapse repeats instead of stacking
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => "focus" in c);
      return open ? open.focus() : self.clients.openWindow(".");
    }),
  );
});
