// Push opt-in + slot sync. Strictly nice-to-have: every failure path is
// silent-but-reported, never blocking. The only bytes that ever leave the
// device: the anonymous push subscription + slot numbers, over TLS.
import { DEFAULT_REMINDERS, slotsFor, type Reminders } from "../engine/index.ts";
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

async function currentSlots(): Promise<number[]> {
  const habits = await db.habits.filter((h) => !h.archivedAt).toArray();
  return slotsFor(await getReminders(), new Date().getTimezoneOffset(), habits);
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

  const ok = await postJson(relay.url, "/subscribe", {
    subscription: sub.toJSON(),
    slots: await currentSlots(),
  });
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
  await postJson(relay.url, "/subscribe", { subscription: sub.toJSON(), slots: await currentSlots() });
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
