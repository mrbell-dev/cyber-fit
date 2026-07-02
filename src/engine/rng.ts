// Deterministic RNG for reward rolls. Seeded on event ids so a roll can never
// be re-rolled by replaying/rebuilding — same log ⇒ same crit, forever.

/** FNV-1a 32-bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — one deterministic float in [0,1) per (id, salt). */
export function rollFor(id: string, salt: string): number {
  let t = (hashString(salt + ":" + id) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
