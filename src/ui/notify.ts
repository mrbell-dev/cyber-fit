// Push opt-in + slot sync. Strictly nice-to-have: every failure path is
// silent-but-reported, never blocking. The only bytes that ever leave the
// device: the anonymous push subscription + slot numbers, over TLS.
import {
  DEFAULT_REMINDERS,
  expandOneShots,
  localPings,
  slotBundleFor,
  weighinCadenceOf,
  type OneShotSpec,
  type Reminders,
} from "../engine/index.ts";
import { db } from "../db/db.ts";
import { getSettings } from "../db/repo.ts";

const REMINDERS_KEY = "reminders";

export async function getReminders(): Promise<Reminders> {
  const row = await db.kv.get(REMINDERS_KEY);
  return { ...DEFAULT_REMINDERS, ...((row?.value as Partial<Reminders>) ?? {}) };
}

export async function saveReminders(patch: Partial<Reminders>): Promise<Reminders> {
  const next = { ...(await getReminders()), ...patch };
  await db.kv.put({ key: REMINDERS_KEY, value: next });
  return next;
}

export interface RelayConfig {
  url: string;
  vapidKey: string;
}

/** Self-host settings win over the baked-in shared relay. */
export async function relayConfig(): Promise<RelayConfig> {
  const s = (await getSettings()) as { relayUrl?: string; relayVapidKey?: string };
  return {
    url: s.relayUrl || import.meta.env.VITE_RELAY_URL || "",
    vapidKey: s.relayVapidKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "",
  };
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function b64ToUint8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Cadences too sparse for the weekly slot grid (only the weigh-in check-in
 * today). Anchored on the last body log; short cadences (≤7 days) already
 * fit the week grid via regular pings, so they don't get one-shots.
 */
async function oneShotSpecs(reminders: Reminders): Promise<OneShotSpec[]> {
  if (reminders.enabled === false) return [];
  const settings = await getSettings();
  const cadence = weighinCadenceOf(settings);
  if (cadence.days <= 7) return [];
  const last = await db.bodyLogs.orderBy("dayKey").last();
  if (!last) return []; // never weighed — nothing to anchor a cadence on
  const anchor = new Date(last.ts);
  anchor.setHours(0, 0, 0, 0);
  return [{
    kind: "bio",
    anchorDayMs: anchor.getTime(),
    periodDays: cadence.days,
    time: reminders.morning.time,
    label: "Weigh-in",
  }];
}

async function currentSlots(): Promise<{ slots: number[]; motivationSlots: number[]; oneShots: number[] }> {
  const habits = await db.habits.filter((h) => !h.archivedAt).toArray();
  const metrics = await db.bioMetrics.filter((m) => !m.archivedAt).toArray();
  const goals = await db.goals.filter((g) => !g.archivedAt).toArray();
  const reminders = await getReminders();
  const tz = new Date().getTimezoneOffset();

  // Deep-link map for the SW: which slot means which kind of ping (stays local).
  const kinds: Record<number, string> = {};
  for (const p of localPings(reminders, habits, metrics, goals)) {
    if (p.kind === "motivation") continue;
    for (const day of p.days) {
      const wrapped = (((day * 1440 + p.minutes + tz) % 10080) + 10080) % 10080;
      const slot = Math.floor(wrapped / 15) * 15;
      kinds[slot] ??= p.kind;
    }
  }
  await db.kv.put({ key: "slotKinds", value: kinds });

  // One-shot slots for monthly-ish cadences (+ their own deep-link map).
  const specs = await oneShotSpecs(reminders);
  const shots = expandOneShots(specs, Date.now(), reminders.quiet);
  const oneShotKinds: Record<number, string> = {};
  for (const s of shots) oneShotKinds[s.at] ??= s.kind;
  await db.kv.put({ key: "oneShotKinds", value: oneShotKinds });

  return { ...slotBundleFor(reminders, tz, habits, metrics, goals), oneShots: shots.map((s) => s.at) };
}

async function postJson(url: string, path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Everything the SW needs to re-upload slots WITHOUT the app open: relay url,
 * the week-slot bundle, and the one-shot specs (so it can re-expand a fresh
 * horizon — re-posting stale absolute slots would let monthly pings run dry).
 */
async function storeResyncPayload(
  url: string,
  bundle: { slots: number[]; motivationSlots: number[] },
): Promise<void> {
  const reminders = await getReminders();
  await db.kv.put({
    key: "pushResync",
    value: {
      url,
      slots: bundle.slots,
      motivationSlots: bundle.motivationSlots,
      specs: await oneShotSpecs(reminders),
      quiet: reminders.quiet,
    },
  });
}

/** Weekly SW re-sync keeps one-shots topped up even if the app stays closed.
 *  Chromium-only (periodicSync); everywhere else the app-open sync covers it. */
async function registerResync(reg: ServiceWorkerRegistration): Promise<void> {
  try {
    const ps = (reg as unknown as { periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void> } }).periodicSync;
    if (!ps) return;
    await ps.register("cyber-fit-resync", { minInterval: 7 * 86_400_000 });
  } catch {
    // permission denied / unsupported — nice-to-have only
  }
}

/** Opt in: permission prompt (must be called from a user gesture) → subscribe → upload. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  const relay = await relayConfig();
  if (!pushSupported()) return { ok: false, reason: "This browser can't do web push (on iOS: install to home screen first, iOS 16.4+)." };
  if (!relay.url || !relay.vapidKey) return { ok: false, reason: "No relay configured — set a relay URL + VAPID key below (self-host) or use a build with a shared relay." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notification permission denied." };

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(relay.vapidKey).buffer as ArrayBuffer,
    }));

  const bundle = await currentSlots();
  const ok = await postJson(relay.url, "/subscribe", {
    subscription: sub.toJSON(),
    ...bundle,
  });
  await storeResyncPayload(relay.url, bundle);
  await registerResync(reg);
  return ok ? { ok: true } : { ok: false, reason: "Relay unreachable — reminders will retry on next app open." };
}

/** Re-upload slots on app open (handles DST drift + schedule edits). */
export async function syncPush(): Promise<void> {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;
  const relay = await relayConfig();
  if (!relay.url) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const bundle = await currentSlots();
  await postJson(relay.url, "/subscribe", { subscription: sub.toJSON(), ...bundle });
  await storeResyncPayload(relay.url, bundle);
  await registerResync(reg);
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const relay = await relayConfig();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  if (relay.url) await postJson(relay.url, "/unsubscribe", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** Immediate self-test: asks the relay to push to THIS device right now. */
export async function testPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "push unsupported here" };
  const relay = await relayConfig();
  if (!relay.url) return { ok: false, reason: "no relay configured" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: false, reason: "not subscribed — enable push first" };
  const ok = await postJson(relay.url, "/test", { subscription: sub.toJSON() });
  return ok ? { ok: true } : { ok: false, reason: "relay declined the test ping" };
}

export async function pushActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) !== null;
}
