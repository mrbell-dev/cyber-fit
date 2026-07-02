// The single source of truth for PlayerState: a full deterministic fold over
// all logs. Called after every write (personal-scale data folds in ~ms) — the
// snapshot can therefore never drift from the logs, and import/repair is free.

import { dayStatus } from "./habits.ts";
import {
  AUGMENTS,
  DAILY_CAP,
  FREEZE_CAP,
  FREEZE_EARN_EVERY,
  levelFromXp,
  makeGrant,
  type Grant,
  type XpSource,
} from "./rewards.ts";
import { addDays, diffDays, type DayKey } from "./time.ts";
import type {
  Habit,
  HabitLog,
  MoodLog,
  PlayerState,
  ReadingLog,
  Settings,
  WaterLog,
  WorkoutLog,
} from "./types.ts";
import { waterTotal } from "./water.ts";

export interface LogBundle {
  habits: Habit[];
  habitLogs: HabitLog[];
  waterLogs: WaterLog[];
  moodLogs: MoodLog[];
  workoutLogs: WorkoutLog[];
  readingLogs: ReadingLog[];
  settings: Settings;
  today: DayKey;
}

export interface RebuildResult {
  state: PlayerState;
  grants: Grant[];
}

/** Chronological XP-earning "moments" derived from raw logs. */
interface Moment {
  eventId: string;
  ts: number;
  dayKey: DayKey;
  source: XpSource;
}

export function rebuild(bundle: LogBundle): RebuildResult {
  const moments = deriveMoments(bundle);
  moments.sort((a, b) => a.ts - b.ts || a.eventId.localeCompare(b.eventId));

  const grants: Grant[] = [];
  const perDaySource = new Map<string, number>(); // `${dayKey}:${source}` → count
  const owned: string[] = [];

  for (const m of moments) {
    const capKey = `${m.dayKey}:${m.source}`;
    const used = perDaySource.get(capKey) ?? 0;
    if (used >= DAILY_CAP[m.source]) continue;
    perDaySource.set(capKey, used + 1);

    const grant = makeGrant(m.eventId, m.dayKey, m.source, owned);
    if (grant.drop) owned.push(grant.drop);
    grants.push(grant);
  }

  const xp = grants.reduce((sum, g) => sum + g.xp, 0);
  const { level } = levelFromXp(xp);

  // Level-gated augments unlock on top of drops.
  for (const a of AUGMENTS) {
    if (a.level !== undefined && level >= a.level && !owned.includes(a.id)) owned.push(a.id);
  }

  const { current, best, freezeTokens } = globalStreakWithShields(
    activeDays(bundle),
    bundle.today,
  );

  return {
    state: {
      xp,
      level,
      freezeTokens,
      globalStreak: { current, best },
      unlockedAugments: owned,
      grantKeys: grants.map((g) => g.key),
    },
    grants,
  };
}

// ---------- moments ----------

function deriveMoments(bundle: LogBundle): Moment[] {
  const { habits, habitLogs, waterLogs, moodLogs, settings } = bundle;
  const moments: Moment[] = [];
  const habitById = new Map(habits.map((h) => [h.id, h]));

  // Habit XP: the log that first makes a habit's day "done".
  const byHabitDay = new Map<string, HabitLog[]>();
  for (const log of habitLogs) {
    const k = `${log.habitId}:${log.dayKey}`;
    const list = byHabitDay.get(k);
    if (list) list.push(log);
    else byHabitDay.set(k, [log]);
  }
  for (const [, logs] of byHabitDay) {
    const habit = habitById.get(logs[0].habitId);
    if (!habit) continue;
    logs.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < logs.length; i++) {
      const before = dayStatus(habit, logs.slice(0, i));
      const after = dayStatus(habit, logs.slice(0, i + 1));
      if (!before.done && after.done) {
        moments.push({ eventId: logs[i].id, ts: logs[i].ts, dayKey: logs[i].dayKey, source: "habit" });
        break; // only the first completion of the day earns
      }
    }
  }

  // Water XP: the log that first crosses the daily goal.
  const byWaterDay = new Map<DayKey, WaterLog[]>();
  for (const log of waterLogs) {
    const list = byWaterDay.get(log.dayKey);
    if (list) list.push(log);
    else byWaterDay.set(log.dayKey, [log]);
  }
  for (const [dayKey, logs] of byWaterDay) {
    logs.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < logs.length; i++) {
      if (
        waterTotal(logs.slice(0, i)) < settings.waterGoalMl &&
        waterTotal(logs.slice(0, i + 1)) >= settings.waterGoalMl
      ) {
        moments.push({ eventId: logs[i].id, ts: logs[i].ts, dayKey, source: "water" });
        break;
      }
    }
  }

  // Mood XP: first check-in of the day.
  const moodDays = new Set<DayKey>();
  for (const log of [...moodLogs].sort((a, b) => a.ts - b.ts)) {
    if (moodDays.has(log.dayKey)) continue;
    moodDays.add(log.dayKey);
    moments.push({ eventId: log.id, ts: log.ts, dayKey: log.dayKey, source: "mood" });
  }

  // Workout XP: every logged workout (daily cap applies downstream).
  for (const log of bundle.workoutLogs) {
    moments.push({ eventId: log.id, ts: log.ts, dayKey: log.dayKey, source: "workout" });
  }

  // Reading XP: each session; a post-reading note earns a bonus grant
  // (both count against the same daily reading cap).
  for (const log of bundle.readingLogs) {
    moments.push({ eventId: log.id, ts: log.ts, dayKey: log.dayKey, source: "reading" });
    if (log.note) {
      moments.push({ eventId: `note-${log.id}`, ts: log.ts + 1, dayKey: log.dayKey, source: "reading" });
    }
  }

  // First-of-day bonus: piggybacks the earliest moment of each day.
  const firstOfDay = new Map<DayKey, Moment>();
  for (const m of moments) {
    const cur = firstOfDay.get(m.dayKey);
    if (!cur || m.ts < cur.ts) firstOfDay.set(m.dayKey, m);
  }
  for (const [dayKey, m] of firstOfDay) {
    moments.push({ eventId: `daily-${m.eventId}`, ts: m.ts, dayKey, source: "daily" });
  }

  // Combo: every domain that has data-entry today satisfied (habit + water + mood).
  const habitDays = new Set(
    moments.filter((m) => m.source === "habit").map((m) => m.dayKey),
  );
  const waterDays = new Set(
    moments.filter((m) => m.source === "water").map((m) => m.dayKey),
  );
  for (const dayKey of habitDays) {
    if (waterDays.has(dayKey) && moodDays.has(dayKey)) {
      const last = moments
        .filter((m) => m.dayKey === dayKey && m.source !== "daily")
        .sort((a, b) => b.ts - a.ts)[0];
      moments.push({ eventId: `combo-${dayKey}`, ts: last.ts, dayKey, source: "combo" });
    }
  }

  return moments;
}

// ---------- global streak + shields ----------

function activeDays(bundle: LogBundle): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const l of bundle.habitLogs) if (l.kind === "done" && l.amount > 0) days.add(l.dayKey);
  for (const l of bundle.waterLogs) if (l.ml > 0) days.add(l.dayKey);
  for (const l of bundle.moodLogs) days.add(l.dayKey);
  for (const l of bundle.workoutLogs) days.add(l.dayKey);
  for (const l of bundle.readingLogs) days.add(l.dayKey);
  return days;
}

/**
 * Walk from first activity to today. Active day → streak grows and every
 * FREEZE_EARN_EVERY-th consecutive day banks a shield (cap FREEZE_CAP).
 * Inactive day → a shield silently absorbs it; no shield → reboot to 0.
 * Today being inactive never breaks (the day isn't over).
 */
export function globalStreakWithShields(
  active: Set<DayKey>,
  today: DayKey,
): { current: number; best: number; freezeTokens: number } {
  if (active.size === 0) return { current: 0, best: 0, freezeTokens: 0 };

  const first = [...active].sort()[0];
  const span = diffDays(first, today);
  let streak = 0;
  let best = 0;
  let tokens = 0;
  let sinceEarn = 0;

  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i);
    if (active.has(day)) {
      streak++;
      sinceEarn++;
      if (sinceEarn >= FREEZE_EARN_EVERY) {
        sinceEarn = 0;
        if (tokens < FREEZE_CAP) tokens++;
      }
    } else if (day === today) {
      // today still in progress — never breaks
    } else if (tokens > 0) {
      tokens--; // shield absorbed the hit (preserves, doesn't extend)
    } else {
      streak = 0;
      sinceEarn = 0;
    }
    if (streak > best) best = streak;
  }

  return { current: streak, best, freezeTokens: tokens };
}
