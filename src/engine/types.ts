import type { DayKey } from "./time.ts";

// ---------- entities ----------

export type Schedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0=Sun … 6=Sat
  | { kind: "timesPerWeek"; target: number } // any N days, Monday-anchored weeks
  | { kind: "nPerX"; times: number; periodDays: number }; // N times per rolling X days
                                                          // (weekly=1/7, monthly=1/30, yearly=1/365)

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
  /** richer per-habit pings: N times/day across a window; untilDone quiets
   *  IN-APP nudges once the habit is satisfied that day (push stays generic
   *  and schedule-blind by design — the relay knows nothing about completion) */
  pings?: { times: number; start: string; end: string; untilDone: boolean };
  /** area of focus (grouping/color; "learning" also feeds the learning streak) */
  area?: Area;
  /** rough slot in the day — Today screen groups by this */
  timeOfDay?: TimeOfDay;
  /** user-set effort weight 1–5 ⚡ — water can be a boss fight, grounding a
   *  freebie. XP is charge-weighted. Default 1. */
  charge?: number;
  /** implementation intention: the existing routine this rides on
   *  ("after I pour coffee"). Best-evidenced habit-formation lever there is. */
  anchor?: string;
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
  /** workout format — plain sets, cardio, or conditioning styles with a score */
  style?: "sets" | "cardio" | "amrap" | "emom" | "fortime" | "tabata";
  /** style-dependent result, e.g. "12 rounds + 5 reps" (AMRAP), "14:32" (for time) */
  score?: string;
  durationMin?: number;
  distance?: number; // in the user's display unit (mi/km per settings)
  note?: string;
  exercises?: { name: string; sets?: { reps?: number; weight?: number }[] }[];
}

/** Which inputs each style shows — "time and distance only where relevant". */
export const WORKOUT_STYLES: {
  id: NonNullable<WorkoutLog["style"]>;
  label: string;
  scoreHint: string;
  fields: { sets?: boolean; score?: boolean; duration?: boolean; distance?: boolean };
}[] = [
  { id: "sets", label: "Sets × reps", scoreHint: "", fields: { sets: true } },
  { id: "cardio", label: "Cardio", scoreHint: "optional pace/notes", fields: { score: true, duration: true, distance: true } },
  { id: "amrap", label: "AMRAP", scoreHint: "rounds + reps, e.g. 12+5", fields: { score: true, duration: true } },
  { id: "emom", label: "EMOM", scoreHint: "e.g. 20 min, all rounds held", fields: { score: true, duration: true } },
  { id: "fortime", label: "For time", scoreHint: "e.g. 14:32", fields: { score: true, distance: true } },
  { id: "tabata", label: "Tabata", scoreHint: "e.g. 8 rounds, low score 9", fields: { score: true, duration: true } },
];

/** Free-form journal entry (the Highlight card's sibling mode). */
export interface JournalLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  text: string;
}

/** Bullet-journal daily task. Unfinished gigs roll forward automatically
 *  (they simply stay visible until done). Tasks, not habits — no streaks. */
export interface Gig {
  id: string;
  text: string;
  createdDay: DayKey;
  ts: number;
  doneTs?: number;
  doneDay?: DayKey;
}

/** User-defined bio metric beyond weight (BP, resting HR, glucose…). */
export interface BioMetric {
  id: string;
  name: string;
  unit: string; // free text: "mmHg", "bpm", …
  createdAt: number;
  archivedAt?: number;
  /** optional reminders, same shape as habit pings */
  pings?: { times: number; start: string; end: string };
}

export interface BioReading {
  id: string;
  metricId: string;
  dayKey: DayKey;
  ts: number;
  /** free text so "120/80" works; charted when numeric */
  value: string;
}

/** Self-screener result (PHQ-9 / GAD-7 — public domain instruments).
 *  DELIBERATELY earns no XP: gamifying symptom reporting biases answers,
 *  and biased trends would poison the Trauma Team export. */
export interface Screening {
  id: string;
  dayKey: DayKey;
  ts: number;
  tool: "phq9" | "gad7";
  score: number;
  answers: number[]; // 0–3 per item
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

export type ReadingType =
  | "book" | "article" | "audiobook" | "video" | "studying" | "class" | "other";

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
  /** display/input unit for water — storage stays canonical ml */
  waterUnit?: "ml" | "oz";
  /** how often the user wants to weigh in; XP spacing scales with it */
  weighinCadence?: WeighinCadence;
  /** level-curve steepness — chosen by the user, changeable anytime */
  difficulty?: "easy" | "standard" | "hard";
  /** show the dev test bench in System */
  devMode?: boolean;
  /** weight is no longer a hardwired metric — it shows once it has data or the
   *  user adds it from the Bio-Scan "+". */
  weightTracked?: boolean;
}

export function difficultyFactor(s: Settings): number {
  return s.difficulty === "easy" ? 0.75 : s.difficulty === "hard" ? 1.5 : 1;
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
