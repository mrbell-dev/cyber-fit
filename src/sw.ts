/// <reference lib="webworker" />
// Custom service worker: Workbox precache (offline-first, same behavior as the
// old generateSW build) + web-push display. Payloads arrive E2E-encrypted;
// a generic fallback renders even if a push comes with no payload.
declare const self: ServiceWorkerGlobalScope;

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { expandOneShots, type OneShotSpec } from "./engine/reminders";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// SPA deep links (/training, /bio, …): serve the precached shell for any
// navigation, so hard reloads on a tab URL work even fully offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

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
  gig: { title: "Gig Window", body: "A gig is on the board. The job won't run itself." },
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

/** Read one row from the Dexie-managed kv store without pulling in Dexie. */
function readKV<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    const req = indexedDB.open("cyber-fit");
    req.onerror = () => resolve(undefined);
    req.onsuccess = () => {
      try {
        const get = req.result.transaction("kv").objectStore("kv").get(key);
        get.onsuccess = () => resolve(get.result?.value as T | undefined);
        get.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    };
  });
}

function writeKV(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open("cyber-fit");
    req.onerror = () => resolve();
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    };
  });
}

/** Which kind of ping is due right now, from the locally stored slot→kind maps
 *  (weekly slots first, then one-shot epoch slots). */
async function currentPingKind(): Promise<string> {
  try {
    const now = new Date();
    const weekMin = now.getUTCDay() * 1440 + now.getUTCHours() * 60 + now.getUTCMinutes();
    const slot = Math.floor(weekMin / 15) * 15;
    const prev = (slot - 15 + 10080) % 10080; // pushes can land a few minutes late
    const kinds = (await readKV<Record<number, string>>("slotKinds")) ?? {};
    const weekly = kinds[slot] ?? kinds[prev];
    if (weekly) return weekly;
    // One-shots key on absolute epoch-minute slots instead of week positions.
    const oneShot = (await readKV<Record<number, string>>("oneShotKinds")) ?? {};
    const epochSlot = Math.floor(now.getTime() / 60000 / 15) * 15;
    return oneShot[epochSlot] ?? oneShot[epochSlot - 15] ?? "";
  } catch {
    return "";
  }
}

/** Weekly background re-sync (Chromium periodicSync): re-expand one-shot
 *  monthly slots from the stored specs and re-upload, so monthly pings keep
 *  firing even if the app stays closed past the pre-uploaded horizon. */
type ResyncPayload = {
  url: string;
  code?: string;
  slots: number[];
  motivationSlots: number[];
  specs: OneShotSpec[];
  quiet?: { on: boolean; start: string; end: string };
};

self.addEventListener("periodicsync", ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag !== "cyber-fit-resync") return;
  event.waitUntil(
    (async () => {
      const payload = await readKV<ResyncPayload>("pushResync");
      const sub = await self.registration.pushManager.getSubscription();
      if (!payload || !sub) return;
      const shots = expandOneShots(payload.specs, Date.now(), payload.quiet);
      // Refresh the on-device deep-link map alongside the relay record.
      const oneShotKinds: Record<number, string> = {};
      for (const s of shots) oneShotKinds[s.at] ??= s.kind;
      await writeKV("oneShotKinds", oneShotKinds);
      await fetch(payload.url.replace(/\/$/, "") + "/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(payload.code ? { "x-cf-access": payload.code } : {}),
        },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          slots: payload.slots,
          motivationSlots: payload.motivationSlots,
          oneShots: shots.map((s) => s.at),
        }),
      }).catch(() => null);
    })(),
  );
}) as EventListener);

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
