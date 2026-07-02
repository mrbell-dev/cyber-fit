// Learning + reading streaks. Learning is satisfied by any learning-domain
// habit done that day OR any reading session; reading by sessions alone.
// Both use the plain forgiving walk: today-in-progress never breaks.

import { addDays, type DayKey } from "./time.ts";
import type { Habit, HabitLog, ReadingLog } from "./types.ts";
import { dayStatus } from "./habits.ts";

/** Consecutive-day streak over a set of satisfied days (today never breaks). */
export function daySetStreak(days: Set<DayKey>, today: DayKey): number {
  let streak = 0;
  let day = today;
  for (let i = 0; i < 3660; i++) {
    if (days.has(day)) streak++;
    else if (day !== today) break;
    day = addDays(day, -1);
  }
  return streak;
}

export function readingDays(readingLogs: ReadingLog[]): Set<DayKey> {
  return new Set(readingLogs.map((l) => l.dayKey));
}

export function learningDays(
  habits: Habit[],
  habitLogs: HabitLog[],
  readingLogs: ReadingLog[],
): Set<DayKey> {
  const days = readingDays(readingLogs);
  const learningHabits = new Map(
    habits.filter((h) => h.domain === "learning").map((h) => [h.id, h]),
  );
  const byHabitDay = new Map<string, HabitLog[]>();
  for (const log of habitLogs) {
    const habit = learningHabits.get(log.habitId);
    if (!habit) continue;
    const k = `${log.habitId}:${log.dayKey}`;
    const list = byHabitDay.get(k);
    if (list) list.push(log);
    else byHabitDay.set(k, [log]);
  }
  for (const [k, logs] of byHabitDay) {
    const habit = learningHabits.get(logs[0].habitId)!;
    if (dayStatus(habit, logs).done) days.add(k.split(":")[1]);
  }
  return days;
}
