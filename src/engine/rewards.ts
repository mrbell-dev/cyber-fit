// XP economy + augment catalog. Scaffold, not grind: cosmetic-only rewards,
// per-source daily caps, deterministic rolls (see rng.ts).

import { rollFor } from "./rng.ts";

export type XpSource =
  | "habit" | "water" | "workout" | "mood" | "reading" | "highlight" | "daily" | "combo";

export const BASE_XP: Record<XpSource, number> = {
  habit: 10,
  water: 15,
  workout: 25,
  mood: 10,
  reading: 15,
  highlight: 10, // one small good thing, noticed
  daily: 20, // first log of the day
  combo: 30, // every tracked domain satisfied in one day
};

/** Max grants per source per day (caps kill grinding). */
export const DAILY_CAP: Record<XpSource, number> = {
  habit: 5,
  water: 1,
  workout: 2,
  mood: 1,
  reading: 2,
  highlight: 1,
  daily: 1,
  combo: 1,
};

export const CRIT_CHANCE = 0.15; // "CRITICAL SYNC" — 2× XP
export const DROP_CHANCE = 0.04; // data-shard → random augment unlock
export const FREEZE_EARN_EVERY = 5; // +1 shield per 5-day global streak
export const FREEZE_CAP = 3;

// ---------- levels ----------

export function xpToNext(level: number): number {
  return 100 + 50 * level;
}

export function levelFromXp(totalXp: number): { level: number; into: number; next: number } {
  let level = 0;
  let rest = totalXp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, next: xpToNext(level) };
}

// ---------- augments (cosmetic ONLY) ----------

export interface Augment {
  id: string;
  name: string;
  desc: string;
  /** unlocked automatically at this level (undefined = shard-drop only) */
  level?: number;
  kind: "theme" | "fx";
}

export const AUGMENTS: Augment[] = [
  { id: "theme-acid", name: "Acid Rain", desc: "Acid-green alt palette", level: 3, kind: "theme" },
  { id: "theme-ember", name: "Ember District", desc: "Blood-orange alt palette", level: 6, kind: "theme" },
  { id: "theme-ice", name: "Cryo Sector", desc: "Ice-blue alt palette", level: 9, kind: "theme" },
  { id: "fx-scanlines", name: "Scanlines", desc: "CRT scanline overlay", kind: "fx" },
  { id: "fx-glitch-title", name: "Glitch Title", desc: "Glitching app title", kind: "fx" },
  { id: "fx-crt-flicker", name: "CRT Flicker", desc: "Subtle screen flicker", kind: "fx" },
];

// ---------- grants ----------

export interface Grant {
  /** deterministic: `${source}:${eventId}` */
  key: string;
  dayKey: string;
  source: XpSource;
  xp: number;
  crit: boolean;
  drop?: string; // augment id
}

/** Roll a grant for an event. Deterministic in (eventId, source, owned). */
export function makeGrant(
  eventId: string,
  dayKey: string,
  source: XpSource,
  owned: string[],
): Grant {
  const crit = rollFor(eventId, "crit") < CRIT_CHANCE;
  const xp = BASE_XP[source] * (crit ? 2 : 1);
  let drop: string | undefined;
  if (rollFor(eventId, "drop") < DROP_CHANCE) {
    const pool = AUGMENTS.filter((a) => !owned.includes(a.id));
    if (pool.length > 0) {
      drop = pool[Math.floor(rollFor(eventId, "pick") * pool.length)].id;
    }
  }
  return { key: `${source}:${eventId}`, dayKey, source, xp, crit, drop };
}
