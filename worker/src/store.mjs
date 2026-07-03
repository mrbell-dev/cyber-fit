// KV storage, isolated so a future D1 (or filesystem, for home-server Node
// hosting) backend is a drop-in swap. Key = sha256(endpoint) — we never need
// to look up by anything user-identifying, because nothing user-identifying
// exists here.

export async function keyFor(endpoint) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "sub:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Slots are UTC WEEK-minutes on a 15-min grid: day(0=Sun)*1440 + minutes,
 * range [0, 10080). Daily reminders expand to 7 slots client-side; weekday
 * reminders (e.g. workout Tue/Thu) map to just those days.
 *
 * record = { subscription, slots: number[] }
 */
export async function putSub(kv, record) {
  const key = await keyFor(record.subscription.endpoint);
  await kv.put(key, JSON.stringify({
    subscription: record.subscription,
    slots: record.slots,
    motivationSlots: record.motivationSlots ?? [],
  }));
}

export async function deleteSub(kv, endpoint) {
  await kv.delete(await keyFor(endpoint));
}

export async function listSubs(kv) {
  const out = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "sub:", cursor });
    for (const { name } of page.keys) {
      const raw = await kv.get(name);
      if (raw) out.push({ key: name, ...JSON.parse(raw) });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

/** Which 15-min week-slot a Date falls in (UTC, floored). */
export function slotOf(date) {
  const weekMin = date.getUTCDay() * 1440 + date.getUTCHours() * 60 + date.getUTCMinutes();
  return Math.floor(weekMin / 15) * 15;
}

/** Validate a client-supplied record; returns an error string or null. */
export function validateRecord(body) {
  const sub = body?.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) {
    return "bad subscription";
  }
  if (!sub.keys || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") {
    return "bad subscription keys";
  }
  const badSlots = (slots) =>
    !Array.isArray(slots) || slots.length > 672 || slots.some(
      (s) => typeof s !== "number" || s < 0 || s >= 10080 || s % 15 !== 0,
    );
  if (badSlots(body?.slots)) return "bad slots";
  if (body?.motivationSlots !== undefined && badSlots(body.motivationSlots)) return "bad slots";
  return null;
}
