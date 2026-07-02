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

// ---------- settings ----------

export interface Settings {
  schemaVersion: number;
  /** hour (0-23) the day rolls over; default 3 */
  dayStartHour: number;
  waterGoalMl: number;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  dayStartHour: 3,
  waterGoalMl: 2000,
};
