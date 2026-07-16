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
 * One-shots are absolute EPOCH-minutes on the same 15-min grid — how the
 * client pushes cadences the weekly grid can't hold (monthly weigh-ins).
 * Still just opaque numbers; the relay learns nothing new.
 *
 * record = { subscription, slots: number[], oneShots?: number[] }
 */
export async function putSub(kv, record) {
  const key = await keyFor(record.subscription.endpoint);
  await kv.put(key, JSON.stringify({
    subscription: record.subscription,
    slots: record.slots,
    motivationSlots: record.motivationSlots ?? [],
    oneShots: record.oneShots ?? [],
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

/**
 * Vault blob with an optimistic-concurrency version (kept in KV metadata so
 * old blobs read as v0). A POST that states the version it built on gets 409
 * when someone else wrote first — the client pulls, merges, retries. A POST
 * without baseVersion is the legacy unconditional write (old app builds).
 * Honest limit: KV read-modify-write isn't atomic across colos, so two writes
 * in the same second can still both land; this catches the real-world case
 * (stale writer minutes behind), not the same-instant pathological one.
 */
const VAULT_TTL = { expirationTtl: 120 * 86400 };

export async function getVault(kv, id) {
  const { value, metadata } = await kv.getWithMetadata(`vault:${id}`);
  return value === null ? null : { blob: value, v: metadata?.v ?? 0 };
}

/** Returns {ok, v} on success or {stale: true, v} for a version conflict. */
export async function putVault(kv, id, blob, baseVersion) {
  const cur = await getVault(kv, id);
  const curV = cur?.v ?? 0;
  if (baseVersion !== undefined && baseVersion !== curV) return { stale: true, v: curV };
  const v = curV + 1;
  await kv.put(`vault:${id}`, blob, { ...VAULT_TTL, metadata: { v } });
  return { ok: true, v };
}

/** Which 15-min week-slot a Date falls in (UTC, floored). */
export function slotOf(date) {
  const weekMin = date.getUTCDay() * 1440 + date.getUTCHours() * 60 + date.getUTCMinutes();
  return Math.floor(weekMin / 15) * 15;
}

/** Which absolute 15-min epoch-slot a Date falls in (for one-shots). */
export function epochSlotOf(date) {
  return Math.floor(date.getTime() / 60_000 / 15) * 15;
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
  if (body?.oneShots !== undefined) {
    const bad = !Array.isArray(body.oneShots) || body.oneShots.length > 64 || body.oneShots.some(
      (s) => !Number.isSafeInteger(s) || s < 0 || s % 15 !== 0,
    );
    if (bad) return "bad one-shots";
  }
  return null;
}
