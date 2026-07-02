// Logic tests for the relay (no network, mock KV): node test.mjs
import assert from "node:assert/strict";
import { keyFor, listSubs, putSub, deleteSub, slotOf, validateRecord } from "./src/store.mjs";

function mockKV() {
  const map = new Map();
  return {
    map,
    async put(k, v) { map.set(k, v); },
    async get(k) { return map.get(k) ?? null; },
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

console.log("worker logic tests OK");
