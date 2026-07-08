// Reminder schedule → UTC week-slots for the push relay. The full schedule
// (labels, themed copy, what it's for) never leaves the device — only the
// slot numbers do. EVERY ping is optional and user-defined.

import type { BioMetric, Habit } from "./types.ts";

export interface Reminders {
  /** master switch — off = no pings anywhere (push or in-app), and editors
   *  hide their ping options entirely. Default on. */
  enabled: boolean;
  /** quiet hours — any ping landing inside the window is deferred to when it
   *  lifts (never fires during quiet). Applies to push AND in-app nudges. */
  quiet: { on: boolean; start: string; end: string };
  morning: { on: boolean; time: string }; // "HH:MM" local
  water: { on: boolean; count: number; start: string; end: string };
  workout: { on: boolean; days: number[]; time: string }; // 0=Sun … 6=Sat
  catchup: { on: boolean; time: string };
  highlight: { on: boolean; time: string }; // savoring nudge — off by default
  /** random encouragement pushes (relay picks the line; off by default) */
  motivation: { on: boolean; count: number; start: string; end: string };
}

export const DEFAULT_REMINDERS: Reminders = {
  enabled: true,
  quiet: { on: false, start: "22:00", end: "07:00" },
  morning: { on: true, time: "08:00" },
  water: { on: true, count: 5, start: "09:00", end: "21:00" },
  workout: { on: true, days: [2, 3, 4], time: "17:30" }, // Tue/Wed/Thu
  catchup: { on: true, time: "21:30" },
  highlight: { on: false, time: "19:00" },
  motivation: { on: false, count: 2, start: "09:00", end: "21:00" },
};

/** Is a local minute-of-day inside the quiet window? Handles overnight wrap
 *  (start > end, e.g. 22:00→07:00). A zero-width window is never quiet. */
export function inQuiet(minutes: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  return startMin < endMin
    ? minutes >= startMin && minutes < endMin
    : minutes >= startMin || minutes < endMin;
}

/** Defer a ping out of quiet hours to the moment quiet lifts (its end). */
function clampToQuiet(minutes: number, quiet: Reminders["quiet"]): number {
  if (!quiet.on) return minutes;
  const s = parseTime(quiet.start);
  const e = parseTime(quiet.end);
  return inQuiet(minutes, s, e) ? e : minutes;
}

export type PingKind = Exclude<keyof Reminders, "enabled" | "quiet"> | "habit" | "bio";

/** Themed copy shown by the app (in-app pings + self-hosted relays). */
export const REMINDER_COPY: Record<PingKind, string> = {
  morning: "Rise and shine, Night City.",
  water: "Hydrate the wetware.",
  workout: "Chrome needs maintenance — training window open.",
  catchup: "Sync your logs before lights out.",
  highlight: "One good frame from today — capture the highlight.",
  motivation: "Keep the chrome polished, choom.",
  habit: "Directive window open.",
  bio: "Bio-scan window — log your reading.",
};

export interface LocalPing {
  kind: PingKind;
  /** minutes since local midnight */
  minutes: number;
  /** local weekdays it fires on (0-6) */
  days: number[];
  /** habit name for kind === "habit" */
  label?: string;
  habitId?: string;
  /** in-app nudges go quiet once the habit is done for the day */
  untilDone?: boolean;
  /** push relay excludes these; only in-app reminders fire */
  inAppOnly?: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h % 24) * 60 + (m % 60);
}

function habitDays(habit: Habit): number[] {
  return habit.schedule.kind === "weekdays" ? [...habit.schedule.days] : ALL_DAYS;
}

/** Expand the schedule + per-habit + per-bio-metric reminders into local ping times. */
export function localPings(r: Reminders, habits: Habit[] = [], metrics: BioMetric[] = []): LocalPing[] {
  if (r.enabled === false) return []; // master switch off → nothing fires anywhere
  const pings: LocalPing[] = [];
  if (r.morning.on) pings.push({ kind: "morning", minutes: parseTime(r.morning.time), days: ALL_DAYS });
  if (r.catchup.on) pings.push({ kind: "catchup", minutes: parseTime(r.catchup.time), days: ALL_DAYS });
  if (r.highlight.on) pings.push({ kind: "highlight", minutes: parseTime(r.highlight.time), days: ALL_DAYS });
  if (r.workout.on && r.workout.days.length > 0) {
    pings.push({ kind: "workout", minutes: parseTime(r.workout.time), days: [...r.workout.days] });
  }
  spread(pings, "water", r.water, ALL_DAYS);
  if (r.motivation.on) spread(pings, "motivation", r.motivation, ALL_DAYS);

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    if (habit.med) {
      const start = parseTime(habit.med.dueTime);
      const days = habitDays(habit);
      for (let t = 0; t < habit.med.windowMin; t += habit.med.remindEveryMin) {
        const minutes = start + t;
        pings.push({
          kind: "habit",
          minutes: minutes % 1440,
          days: minutes < 1440 ? [...days] : days.map((d) => (d + 1) % 7),
          label: habit.name,
          habitId: habit.id,
          untilDone: true,
          ...(t > 0 ? { inAppOnly: true } : {}),
        });
      }
      continue; // med reminders replace manual pings/reminderTime for this habit
    }
    if (habit.pings && habit.pings.times > 0) {
      spread(
        pings,
        "habit",
        { on: true, count: habit.pings.times, start: habit.pings.start, end: habit.pings.end },
        habitDays(habit),
        { label: habit.name, habitId: habit.id, untilDone: habit.pings.untilDone },
      );
    } else if (habit.reminderTime) {
      pings.push({
        kind: "habit",
        minutes: parseTime(habit.reminderTime),
        days: habitDays(habit),
        label: habit.name,
        habitId: habit.id,
      });
    }
  }
  for (const m of metrics) {
    if (m.archivedAt || !m.pings || m.pings.times <= 0) continue;
    spread(
      pings,
      "bio",
      { on: true, count: m.pings.times, start: m.pings.start, end: m.pings.end },
      ALL_DAYS,
      { label: m.name },
    );
  }
  // Quiet hours defer every ping (system, habit, bio) out of the window.
  if (r.quiet?.on) return pings.map((p) => ({ ...p, minutes: clampToQuiet(p.minutes, r.quiet) }));
  return pings;
}

/** Spread `count` pings evenly across a start–end window. */
function spread(
  pings: LocalPing[],
  kind: PingKind,
  cfg: { on: boolean; count: number; start: string; end: string },
  days: number[],
  extra: Partial<LocalPing> = {},
): void {
  if (!cfg.on || cfg.count <= 0) return;
  const start = parseTime(cfg.start);
  const end = parseTime(cfg.end);
  const n = Math.min(24, Math.max(1, Math.round(cfg.count)));
  const span = Math.max(0, end - start);
  for (let i = 0; i < n; i++) {
    const minutes = n === 1 ? start : start + Math.round((span * i) / (n - 1));
    pings.push({ kind, minutes, days: [...days], ...extra });
  }
}

function toSlots(pings: LocalPing[], tzOffsetMinutes: number): number[] {
  const slots = new Set<number>();
  for (const ping of pings) {
    for (const day of ping.days) {
      const utcWeekMin = day * 1440 + ping.minutes + tzOffsetMinutes;
      const wrapped = ((utcWeekMin % 10080) + 10080) % 10080;
      slots.add(Math.floor(wrapped / 15) * 15);
    }
  }
  return [...slots].sort((a, b) => a - b);
}

/**
 * Local pings → sorted, deduped UTC week-slots (15-min grid, [0,10080)),
 * split so the relay can send a motivational line for motivation slots and
 * the generic "time to sync" for everything else.
 * tzOffsetMinutes uses the JS getTimezoneOffset convention (local + offset = UTC).
 */
export function slotBundleFor(
  r: Reminders,
  tzOffsetMinutes: number,
  habits: Habit[] = [],
  metrics: BioMetric[] = [],
): { slots: number[]; motivationSlots: number[] } {
  const pings = localPings(r, habits, metrics);
  return {
    slots: toSlots(pings.filter((p) => p.kind !== "motivation" && !p.inAppOnly), tzOffsetMinutes),
    motivationSlots: toSlots(pings.filter((p) => p.kind === "motivation" && !p.inAppOnly), tzOffsetMinutes),
  };
}

/** Reminder slots only (no motivation) — kept for tests/back-compat. */
export function slotsFor(r: Reminders, tzOffsetMinutes: number, habits: Habit[] = []): number[] {
  return slotBundleFor(r, tzOffsetMinutes, habits).slots;
}

/**
 * Pings already due today (local) — for the in-app MISSED PING banner.
 * `nowMinutes` = minutes since local midnight; `weekday` = local day 0-6.
 */
export function duePingsToday(
  r: Reminders,
  weekday: number,
  nowMinutes: number,
  habits: Habit[] = [],
): LocalPing[] {
  return localPings(r, habits).filter((p) => p.days.includes(weekday) && p.minutes <= nowMinutes);
}
