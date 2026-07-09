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

// Kind-specific copy rendered ON-DEVICE (the relay only knows
// generic/motivation/test). iOS shows "from cyber-fit" itself, so titles
// must carry meaning, never repeat the app name.
const PING_COPY: Record<string, { title: string; body: string }> = {
  morning: { title: "Rise and Shine", body: "New day on the grid. Boot up when you're ready." },
  water: { title: "Hydration Ping", body: "Hydrate the wetware." },
  workout: { title: "Training Window", body: "Chrome needs maintenance. Tap to log it." },
  catchup: { title: "End-of-Day Sync", body: "Log the day before lights out." },
  highlight: { title: "One Good Frame", body: "Capture today's highlight — anything real counts." },
  habit: { title: "Directive Window", body: "A directive is ready when you are." },
  bio: { title: "Bio-Scan Window", body: "Run a bio-scan — weight, sleep, vitals. Jack in." },
};

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data: { type?: string; body?: string } = {};
      try {
        data = event.data?.json() ?? {};
      } catch {
        // fall through to generic copy
      }
      let title = "Sync Window";
      let body = "Time to check in.";
      if (data.type === "motivation" && data.body) {
        title = "Incoming Transmission";
        body = data.body;
      } else if (data.type === "test" && data.body) {
        title = "Uplink Test";
        body = data.body;
      } else {
        const kind = await currentPingKind();
        const copy = PING_COPY[kind];
        if (copy) ({ title, body } = copy);
      }
      await self.registration.showNotification(title, {
        body,
        icon: "icon-192.png",
        badge: "icon-192.png",
        tag: "cyber-fit-ping", // collapse repeats instead of stacking
      });
    })(),
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
