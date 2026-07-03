// Reminder schedule → UTC week-slots for the push relay. The full schedule
// (labels, themed copy, what it's for) never leaves the device — only the
// slot numbers do. EVERY ping is optional and user-defined.

import type { Habit } from "./types.ts";

export interface Reminders {
  morning: { on: boolean; time: string }; // "HH:MM" local
  water: { on: boolean; count: number; start: string; end: string };
  workout: { on: boolean; days: number[]; time: string }; // 0=Sun … 6=Sat
  catchup: { on: boolean; time: string };
  highlight: { on: boolean; time: string }; // savoring nudge — off by default
}

export const DEFAULT_REMINDERS: Reminders = {
  morning: { on: true, time: "08:00" },
  water: { on: true, count: 5, start: "09:00", end: "21:00" },
  workout: { on: true, days: [2, 3, 4], time: "17:30" }, // Tue/Wed/Thu
  catchup: { on: true, time: "21:30" },
  highlight: { on: false, time: "19:00" },
};

export type PingKind = keyof Reminders | "habit";

/** Themed copy shown by the app (in-app pings + self-hosted relays). */
export const REMINDER_COPY: Record<PingKind, string> = {
  morning: "Rise and shine, Night City.",
  water: "Hydrate the wetware.",
  workout: "Chrome needs maintenance — training window open.",
  catchup: "Sync your logs before lights out.",
  highlight: "One good frame from today — capture the highlight.",
  habit: "Directive window open.",
};

export interface LocalPing {
  kind: PingKind;
  /** minutes since local midnight */
  minutes: number;
  /** local weekdays it fires on (0-6) */
  days: number[];
  /** habit name for kind === "habit" */
  label?: string;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h % 24) * 60 + (m % 60);
}

function habitDays(habit: Habit): number[] {
  return habit.schedule.kind === "weekdays" ? [...habit.schedule.days] : ALL_DAYS;
}

/** Expand the schedule + per-habit reminders into concrete local ping times. */
export function localPings(r: Reminders, habits: Habit[] = []): LocalPing[] {
  const pings: LocalPing[] = [];
  if (r.morning.on) pings.push({ kind: "morning", minutes: parseTime(r.morning.time), days: ALL_DAYS });
  if (r.catchup.on) pings.push({ kind: "catchup", minutes: parseTime(r.catchup.time), days: ALL_DAYS });
  if (r.highlight.on) pings.push({ kind: "highlight", minutes: parseTime(r.highlight.time), days: ALL_DAYS });
  if (r.workout.on && r.workout.days.length > 0) {
    pings.push({ kind: "workout", minutes: parseTime(r.workout.time), days: [...r.workout.days] });
  }
  if (r.water.on && r.water.count > 0) {
    const start = parseTime(r.water.start);
    const end = parseTime(r.water.end);
    const n = Math.min(24, Math.max(1, Math.round(r.water.count)));
    const span = Math.max(0, end - start);
    for (let i = 0; i < n; i++) {
      const minutes = n === 1 ? start : start + Math.round((span * i) / (n - 1));
      pings.push({ kind: "water", minutes, days: ALL_DAYS });
    }
  }
  for (const habit of habits) {
    if (!habit.reminderTime || habit.archivedAt) continue;
    pings.push({
      kind: "habit",
      minutes: parseTime(habit.reminderTime),
      days: habitDays(habit),
      label: habit.name,
    });
  }
  return pings;
}

/**
 * Local pings → sorted, deduped UTC week-slots (15-min grid, [0,10080)).
 * tzOffsetMinutes uses the JS getTimezoneOffset convention (local + offset = UTC).
 */
export function slotsFor(r: Reminders, tzOffsetMinutes: number, habits: Habit[] = []): number[] {
  const slots = new Set<number>();
  for (const ping of localPings(r, habits)) {
    for (const day of ping.days) {
      const utcWeekMin = day * 1440 + ping.minutes + tzOffsetMinutes;
      const wrapped = ((utcWeekMin % 10080) + 10080) % 10080;
      slots.add(Math.floor(wrapped / 15) * 15);
    }
  }
  return [...slots].sort((a, b) => a - b);
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
