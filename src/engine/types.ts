import type { DayKey } from "./time.ts";

// ---------- entities ----------

export type Schedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0=Sun … 6=Sat
  | { kind: "timesPerWeek"; target: number }; // any N days, Monday-anchored weeks

export type HabitDomain = "general" | "learning";

/** Area of focus — grouping, color, and (for "learning") streak wiring. */
export type Area = "mind" | "body" | "health" | "sleep" | "nutrition" | "learning" | "grounding";

export const AREAS: { id: Area; name: string; icon: string }[] = [
  { id: "mind", name: "Mind", icon: "🧠" },
  { id: "body", name: "Body", icon: "🦾" },
  { id: "health", name: "Health", icon: "❤️" },
  { id: "sleep", name: "Sleep", icon: "🌙" },
  { id: "nutrition", name: "Nutrition", icon: "🥗" },
  { id: "learning", name: "Learning", icon: "📖" },
  { id: "grounding", name: "Grounding", icon: "🧘" },
];

export type TimeOfDay = "morning" | "day" | "evening" | "anytime";

export interface Habit {
  id: string;
  name: string;
  icon: string; // single emoji/glyph shown on the card
  schedule: Schedule;
  domain: HabitDomain;
  /** completions needed per day (partial credit below it); default 1 */
  target: number;
  /** optional per-habit reminder, "HH:MM" local; fires on scheduled days only */
  reminderTime?: string;
  /** area of focus (grouping/color; "learning" also feeds the learning streak) */
  area?: Area;
  /** rough slot in the day — Today screen groups by this */
  timeOfDay?: TimeOfDay;
  /** set when installed from the Directive Library (enables clean re-install) */
  presetId?: string;
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
  distance?: number; // in the user's display unit (mi/km per settings)
  note?: string;
  exercises?: { name: string; sets?: { reps?: number; weight?: number }[] }[];
}

/** Body metrics — monthly weigh-ins by design (fluctuations are noise; trend is signal). */
export interface BodyLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  /** in the user's display unit at log time */
  weight: number;
  unit: "lbs" | "kg";
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

/** "Highlight of the day" — one small good thing. Evidence-based savoring
 *  practice; counters all-or-nothing thinking. One per day earns XP. */
export interface HighlightLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  text: string;
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
  /** self-hosted push relay overrides (optional; empty = use build defaults) */
  relayUrl?: string;
  relayVapidKey?: string;
  /** enabled fx augment ids (opt-in; motion fx also respect prefers-reduced-motion) */
  activeFx?: string[];
  weightUnit?: "lbs" | "kg";
  distanceUnit?: "mi" | "km";
  /** how often the user wants to weigh in; XP spacing scales with it */
  weighinCadence?: WeighinCadence;
}

export type WeighinCadence = "daily" | "weekly" | "biweekly" | "monthly" | "bimonthly";

export const WEIGHIN_CADENCES: {
  id: WeighinCadence;
  label: string;
  /** the check-in window ("due after N days") */
  days: number;
  /** min days between XP-earning scans (~70% of cadence — early-ish is fine) */
  xpSpacing: number;
}[] = [
  { id: "daily", label: "Daily", days: 1, xpSpacing: 1 },
  { id: "weekly", label: "Weekly", days: 7, xpSpacing: 5 },
  { id: "biweekly", label: "Every 2 weeks", days: 14, xpSpacing: 10 },
  { id: "monthly", label: "Monthly", days: 30, xpSpacing: 21 },
  { id: "bimonthly", label: "Every 2 months", days: 60, xpSpacing: 42 },
];

export function weighinCadenceOf(settings: Settings): (typeof WEIGHIN_CADENCES)[number] {
  return WEIGHIN_CADENCES.find((c) => c.id === (settings.weighinCadence ?? "monthly"))!;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  dayStartHour: 3,
  waterGoalMl: 2000,
  activeTheme: "electric-city",
};
