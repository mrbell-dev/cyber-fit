import type { DayKey } from "./time.ts";

// ---------- entities ----------

export type Schedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0=Sun … 6=Sat
  | { kind: "timesPerWeek"; target: number }; // any N days, Monday-anchored weeks

export type HabitDomain = "general" | "learning";

export interface Habit {
  id: string;
  name: string;
  icon: string; // single emoji/glyph shown on the card
  schedule: Schedule;
  domain: HabitDomain;
  /** completions needed per day (partial credit below it); default 1 */
  target: number;
  createdAt: number;
  archivedAt?: number;
  order: number;
}

// ---------- event logs (append-only) ----------

export interface HabitLog {
  id: string;
  habitId: string;
  dayKey: DayKey;
  ts: number;
  /** +1 per tap; negative entries undo (sum per day is what counts) */
  amount: number;
  /** "skip" = intentional rest; preserves streaks, earns no XP */
  kind: "done" | "skip";
}

export interface WaterLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  /** negative ml = undo */
  ml: number;
}

export interface WorkoutLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  /** fast path: just a name ("Lift", "5k walk") */
  name: string;
  durationMin?: number;
  note?: string;
  exercises?: { name: string; sets?: { reps?: number; weightKg?: number }[] }[];
}

export type ReadingType = "book" | "article" | "audiobook" | "other";

export interface ReadingItem {
  id: string;
  title: string;
  author?: string;
  type: ReadingType;
  status: "reading" | "finished" | "abandoned";
  createdAt: number;
  finishedAt?: number;
}

export interface ReadingLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  itemId?: string;
  minutes?: number;
  /** post-reading reflection — what it said, how it landed */
  note?: string;
  feeling?: 1 | 2 | 3 | 4 | 5;
}

export interface MoodLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  rating: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

// ---------- derived player state (rebuildable from logs; never hand-edited) ----------

export interface PlayerState {
  xp: number;
  level: number;
  freezeTokens: number;
  /** consecutive days with any positive log; shields auto-absorb gaps */
  globalStreak: { current: number; best: number };
  unlockedAugments: string[];
  /** grant keys already awarded (idempotence for incremental updates) */
  grantKeys: string[];
}

// ---------- settings ----------

export interface Settings {
  schemaVersion: number;
  /** hour (0-23) the day rolls over; default 3 */
  dayStartHour: number;
  waterGoalMl: number;
  /** theme id from the theme registry (unlocked via augments) */
  activeTheme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  dayStartHour: 3,
  waterGoalMl: 2000,
  activeTheme: "electric-city",
};
