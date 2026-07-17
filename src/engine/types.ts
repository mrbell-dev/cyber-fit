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
export type Area = "mind" | "body" | "health" | "sleep" | "nutrition" | "learning" | "grounding" | "meds";

export const AREAS: { id: Area; name: string; icon: string }[] = [
  { id: "mind", name: "Mind", icon: "🧠" },
  { id: "body", name: "Body", icon: "🦾" },
  { id: "health", name: "Health", icon: "❤️" },
  { id: "sleep", name: "Sleep", icon: "🌙" },
  { id: "nutrition", name: "Nutrition", icon: "🥗" },
  { id: "learning", name: "Learning", icon: "📖" },
  { id: "grounding", name: "Grounding", icon: "🧘" },
  { id: "meds", name: "Meds", icon: "💊" },
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
  /** medication semantics: a dose window that opens at dueTime and closes
   *  windowMin later; in-app/SMS reminders repeat every remindEveryMin until
   *  taken or closed. Push stays a single generic dueTime ping. */
  med?: { nickname?: string; dueTime: string; remindEveryMin: number; windowMin: number };
  createdAt: number;
  archivedAt?: number;
  order: number;
}

/** A lens over existing logs — derives progress toward a target, never writes.
 *  Public repo: keep example names generic ("Deep talks", "Pages"). */
export interface Goal {
  id: string;
  name: string;
  /** single emoji/glyph shown next to the name */
  icon?: string;
  /** "lifelong" never resets — it counts all-time with no deadline. */
  horizon: "week" | "month" | "year" | "lifelong";
  /** optional: absent/0 = open-ended (track the running count, no bar/pace). */
  target?: number;
  source:
    | { kind: "habits"; habitIds: string[] }
    | { kind: "readingPages" }
    | { kind: "workouts" }
    // manual tally — progress comes from GoalLog rows the user adds by hand.
    | { kind: "manual" };
  /** optional daily nudge, "HH:MM" local. OFF by default (absent) — goals never
   *  push unless the user opts in here. Inherits the master switch + quiet hours. */
  reminderTime?: string;
  createdAt: number;
  archivedAt?: number;
  order: number;
}

/** A hand-added increment toward a manual-source goal. Append-only event log,
 *  like every other tracker; amount can be negative to undo. */
export interface GoalLog {
  id: string;
  goalId: string;
  dayKey: DayKey;
  ts: number;
  amount: number;
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

export type WorkoutStyleId = "general" | "sets" | "cardio" | "amrap" | "emom" | "fortime" | "tabata";

/** One movement/exercise inside a block, e.g. "Back squats" or "10 pull-ups". */
export interface WorkoutMovement {
  name?: string;
  /** a single rep target — for metcon movements ("10 pull-ups" → reps 10). */
  reps?: number;
  /** reps×weight sets — ONLY for the "sets" block type. */
  sets?: { reps?: number; weight?: number }[];
  weightUnit?: "lbs" | "kg";
}

/** One block within a session: a homogeneous, typed group of movements. A
 *  session can mix blocks (an AMRAP block AND a sets block). The block owns the
 *  type + any block-level result (score/time/distance); movements live in
 *  `movements`. Legacy flat fields (name/sets/…) are read-only compat, folded by
 *  `workoutBlocks()`/`workoutParts()` for logs written before the block model. */
export interface WorkoutPart {
  /** block title, e.g. "Part A", "Metcon". Absent = untitled/single block. */
  block?: string;
  style: WorkoutStyleId;
  /** block-level result, e.g. "12 rounds + 5 reps" (AMRAP), "14:32" (for time) */
  score?: string;
  durationMin?: number;
  distance?: number;
  distanceUnit?: "mi" | "km";
  /** free-text detail for the block (mainly the "general" style). */
  note?: string;
  /** the block's movements (the block model). */
  movements?: WorkoutMovement[];
  // ---- legacy movement-level fields (pre-block-model): read-only compat ----
  name?: string;
  weightUnit?: "lbs" | "kg";
  sets?: { reps?: number; weight?: number }[];
}

export interface WorkoutLog {
  id: string;
  dayKey: DayKey;
  ts: number;
  /** the session name ("Tuesday workout", "Wednesday class") */
  name: string;
  /** how hard it hit, 1–5 (the effort gauge). Informational only — earns no XP
   *  by design (gamifying effort self-report corrupts it). */
  intensity?: 1 | 2 | 3 | 4 | 5;
  /** the session's blocks. Read via `workoutParts()`, which synthesizes a
   *  single block from the legacy flat fields below for pre-parts logs. */
  parts?: WorkoutPart[];
  note?: string;
  // ---- legacy flat fields: read-only compat for logs written before `parts`.
  //      New logs never populate these — see workoutParts(). ----
  style?: WorkoutStyleId;
  score?: string;
  durationMin?: number;
  distance?: number;
  exercises?: { name: string; sets?: { reps?: number; weight?: number }[] }[];
}

/** Which inputs each style shows — "time and distance only where relevant".
 *  "general" is the default: a plain session with just an optional duration. */
export const WORKOUT_STYLES: {
  id: WorkoutStyleId;
  label: string;
  scoreHint: string;
  fields: { sets?: boolean; score?: boolean; duration?: boolean; distance?: boolean; note?: boolean };
}[] = [
  { id: "general", label: "General", scoreHint: "", fields: { duration: true } },
  { id: "sets", label: "Sets × reps", scoreHint: "", fields: { sets: true } },
  { id: "cardio", label: "Cardio", scoreHint: "", fields: { duration: true, distance: true } },
  { id: "amrap", label: "AMRAP", scoreHint: "", fields: { duration: true } },
  { id: "emom", label: "EMOM", scoreHint: "", fields: { duration: true } },
  { id: "fortime", label: "For time", scoreHint: "", fields: { distance: true } },
  { id: "tabata", label: "Tabata", scoreHint: "", fields: { duration: true } },
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
  /** retired via the daily migration (dropped from the board without being
   *  completed) — kept for history, never deleted. */
  retiredDay?: DayKey;
  /** set when this gig was spawned from a recurring template — the spawn
   *  guard uses it to avoid putting the same job on the board twice. */
  templateId?: string;
}

/** Recurring gig template — spawns a fresh gig row on matching local weekdays.
 *  Retired templates stop spawning but keep their row (no-delete doctrine). */
export interface GigTemplate {
  id: string;
  text: string;
  /** local weekdays it spawns on (0-6, Sunday = 0) */
  days: number[];
  ts: number;
  retiredTs?: number;
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
  /** pages read this session — feeds pages goals */
  pages?: number;
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
  /** shared-relay access code (closed beta) — sent as x-cf-access on every relay call */
  relayCode?: string;
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
  /** show the change-since-last-scan delta on the weight row. OFF by default:
   *  a running delta is eating-disorder-adjacent; the trend chart covers the
   *  same information for those who want it. */
  showWeightDelta?: boolean;
  /** starred workout *names* (lowercased) — favoriting means "this named
   *  workout", past and future, not one log row. Logs stay untouched
   *  (no-delete doctrine); unstarring is just a settings patch. */
  favoriteWorkouts?: string[];
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
