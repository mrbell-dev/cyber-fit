// Logic tests for the relay (no network, mock KV): node test.mjs
import assert from "node:assert/strict";
import { getVault, keyFor, listSubs, putSub, putVault, deleteSub, slotOf, validateRecord } from "./src/store.mjs";

function mockKV() {
  const map = new Map();
  return {
    map,
    async put(k, v, opts) { map.set(k, { v, metadata: opts?.metadata ?? null, opts: opts ?? null }); },
    async get(k) { return map.get(k)?.v ?? null; },
    async getWithMetadata(k) {
      const hit = map.get(k);
      return { value: hit?.v ?? null, metadata: hit?.metadata ?? null };
    },
    async delete(k) { map.delete(k); },
    async list({ prefix }) {
      return {
        keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

const sub = (n) => ({
  endpoint: `https://push.example/${n}`,
  keys: { p256dh: "k", auth: "a" },
});

// slotOf floors to the 15-min WEEK grid (2026-07-02 is a Thursday = day 4)
assert.equal(slotOf(new Date("2026-06-28T00:00:00Z")), 0); // Sunday 00:00
assert.equal(slotOf(new Date("2026-07-02T09:14:59Z")), 4 * 1440 + 540);
assert.equal(slotOf(new Date("2026-07-02T09:15:00Z")), 4 * 1440 + 555);
assert.equal(slotOf(new Date("2026-07-04T23:59:00Z")), 6 * 1440 + 1425); // Sat end of week

// validateRecord
assert.equal(validateRecord({ subscription: sub(1), slots: [0, 555, 9585] }), null);
assert.ok(validateRecord({ subscription: sub(1), slots: [7] }));        // off-grid slot
assert.ok(validateRecord({ subscription: sub(1), slots: [10080] }));    // out of range
assert.ok(validateRecord({ subscription: { endpoint: "http://x" }, slots: [] })); // not https / no keys
assert.ok(validateRecord({ slots: [0] }));                             // no subscription

// put → list → delete round-trip; key is a hash, not the endpoint
const kv = mockKV();
await putSub(kv, { subscription: sub(1), slots: [540] });
await putSub(kv, { subscription: sub(2), slots: [600] });
const all = await listSubs(kv);
assert.equal(all.length, 2);
assert.ok([...kv.map.keys()].every((k) => /^sub:[0-9a-f]{64}$/.test(k)));
assert.ok(!JSON.stringify([...kv.map.keys()]).includes("push.example")); // endpoint not in keys
await deleteSub(kv, sub(1).endpoint);
assert.equal((await listSubs(kv)).length, 1);
assert.equal((await keyFor(sub(1).endpoint)).length, 4 + 64);

// vault CAS: versions climb, stale baseVersion rejected, legacy write unconditional
const vkv = mockKV();
assert.equal(await getVault(vkv, "aa".repeat(16)), null);
const id = "ab".repeat(16);
let r = await putVault(vkv, id, "blob1");            // legacy (no baseVersion)
assert.deepEqual(r, { ok: true, v: 1 });
assert.deepEqual(await getVault(vkv, id), { blob: "blob1", v: 1 });
r = await putVault(vkv, id, "blob2", 1);             // CAS on current version
assert.deepEqual(r, { ok: true, v: 2 });
r = await putVault(vkv, id, "blob-stale", 1);        // built on v1, but v2 exists
assert.deepEqual(r, { stale: true, v: 2 });
assert.deepEqual(await getVault(vkv, id), { blob: "blob2", v: 2 }); // untouched
r = await putVault(vkv, id, "blob3");                // legacy write still lands, bumps v
assert.deepEqual(r, { ok: true, v: 3 });
// pre-CAS blob (no metadata) reads as v0 and CAS-writes from 0
vkv.map.set(`vault:${"cd".repeat(16)}`, { v: "oldblob", metadata: null });
assert.deepEqual(await getVault(vkv, "cd".repeat(16)), { blob: "oldblob", v: 0 });
assert.deepEqual(await putVault(vkv, "cd".repeat(16), "new", 0), { ok: true, v: 1 });

// --- access code + TTL (fetch handler, mock env) ---
import worker from "./src/index.mjs";

const akv = mockKV();
const env = { SUBS: akv, ACCESS_CODE: "sesame", ALLOWED_ORIGIN: "*", VAPID_PRIVATE_JWK: "{}" };
const req = (path, { method = "GET", body, code } = {}) =>
  new Request(`https://relay.test${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: {
      "Content-Type": "application/json",
      ...(code !== undefined ? { "x-cf-access": code } : {}),
    },
  });
const subBody = { subscription: sub(9), slots: [540] };

// /health and OPTIONS stay open
assert.equal((await worker.fetch(req("/health"), env)).status, 200);
assert.equal((await worker.fetch(req("/subscribe", { method: "OPTIONS" }), env)).status, 204);
// everything else: 401 without or with a wrong code — including GET /vault and /unsubscribe
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody }), env)).status, 401);
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody, code: "wrong" }), env)).status, 401);
assert.equal((await worker.fetch(req(`/vault?id=${"ab".repeat(16)}`, { code: "wrong" }), env)).status, 401);
assert.equal((await worker.fetch(req("/unsubscribe", { method: "POST", body: { endpoint: sub(9).endpoint } }), env)).status, 401);
// right code works, and the subscription lands with a 30-day TTL
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody, code: "sesame" }), env)).status, 200);
assert.equal([...akv.map.values()][0].opts.expirationTtl, 30 * 86400);
// no ACCESS_CODE configured (self-host) → open
const openEnv = { SUBS: mockKV(), ALLOWED_ORIGIN: "*" };
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody }), openEnv)).status, 200);
// CORS allows the header
const preflight = await worker.fetch(req("/subscribe", { method: "OPTIONS" }), env);
assert.ok(preflight.headers.get("Access-Control-Allow-Headers").includes("x-cf-access"));

console.log("worker logic tests OK");
