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

/** Which kind of ping is due right now, from the locally stored slot→kind map. */
async function currentPingKind(): Promise<string> {
  try {
    const kinds = await new Promise<Record<number, string>>((resolve) => {
      const req = indexedDB.open("cyber-fit");
      req.onerror = () => resolve({});
      req.onsuccess = () => {
        try {
          const get = req.result.transaction("kv").objectStore("kv").get("slotKinds");
          get.onsuccess = () => resolve((get.result?.value as Record<number, string>) ?? {});
          get.onerror = () => resolve({});
        } catch {
          resolve({});
        }
      };
    });
    const now = new Date();
    const weekMin = now.getUTCDay() * 1440 + now.getUTCHours() * 60 + now.getUTCMinutes();
    const slot = Math.floor(weekMin / 15) * 15;
    const prev = (slot - 15 + 10080) % 10080; // pushes can land a few minutes late
    return kinds[slot] ?? kinds[prev] ?? "";
  } catch {
    return "";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const kind = await currentPingKind();
      const url = kind ? `./?go=${kind}` : ".";
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = clients.find((c) => "focus" in c);
      if (open) {
        if (kind && "navigate" in open) await (open as WindowClient).navigate(url).catch(() => null);
        return open.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
