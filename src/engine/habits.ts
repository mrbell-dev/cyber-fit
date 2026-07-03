import type { DayKey } from "./time.ts";
import { addDays, weekdayOf, weekKeyOf } from "./time.ts";
import type { Habit, HabitLog } from "./types.ts";

/** Is this habit scheduled on the given day? (timesPerWeek is "any day counts") */
export function isScheduledOn(habit: Habit, day: DayKey): boolean {
  switch (habit.schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return habit.schedule.days.includes(weekdayOf(day));
    case "timesPerWeek":
      return true;
    case "nPerX":
      return true;
  }
}

export interface DayStatus {
  /** summed positive progress for the day */
  count: number;
  /** count >= target */
  done: boolean;
  /** an intentional skip was logged (preserves streak, no XP) */
  skipped: boolean;
}

/** Fold a day's logs for one habit into its status. */
export function dayStatus(habit: Habit, logs: HabitLog[]): DayStatus {
  let count = 0;
  let skipped = false;
  for (const log of logs) {
    if (log.kind === "skip") skipped = true;
    else count += log.amount;
  }
  count = Math.max(0, count);
  return { count, done: count >= habit.target, skipped };
}

/**
 * Streak for a habit, walking back from `today`.
 *
 * `satisfied` / `skipped`: per-dayKey status derived from logs (see dayStatus).
 * Forgiving rules:
 *  - unscheduled days never break anything;
 *  - a skipped day preserves the streak but doesn't extend it;
 *  - `today` not being done yet never breaks the streak (the day isn't over);
 *  - timesPerWeek habits streak by consecutive satisfied WEEKS (current week
 *    can't fail while it's still in progress).
 */
export function habitStreak(
  habit: Habit,
  satisfied: Set<DayKey>,
  skipped: Set<DayKey>,
  today: DayKey,
): number {
  if (habit.schedule.kind === "timesPerWeek") {
    return weeklyStreak(habit.schedule.target, satisfied, today);
  }
  if (habit.schedule.kind === "nPerX") {
    return nPerXStreak(habit.schedule.times, habit.schedule.periodDays, satisfied, today);
  }

  let streak = 0;
  let day = today;
  // Cap the walk to keep this O(bounded) even with ancient histories.
  for (let i = 0; i < 3660; i++) {
    if (isScheduledOn(habit, day)) {
      if (satisfied.has(day)) {
        streak++;
      } else if (skipped.has(day)) {
        // preserves, doesn't extend
      } else if (day !== today) {
        break; // a missed scheduled day (today still in progress never breaks)
      }
    }
    day = addDays(day, -1);
  }
  return streak;
}

/** Consecutive rolling X-day periods (newest ending today) with >= times satisfied
 *  days. The in-progress current period counts when met, never breaks while open. */
function nPerXStreak(times: number, periodDays: number, satisfied: Set<DayKey>, today: DayKey): number {
  const countIn = (end: DayKey): number => {
    let n = 0;
    for (let i = 0; i < periodDays; i++) if (satisfied.has(addDays(end, -i))) n++;
    return n;
  };
  let streak = 0;
  if (countIn(today) >= times) streak++;
  let end = addDays(today, -periodDays);
  for (let i = 0; i < Math.ceil(3660 / periodDays); i++) {
    if (countIn(end) >= times) {
      streak++;
      end = addDays(end, -periodDays);
    } else {
      break;
    }
  }
  return streak;
}

/** Consecutive weeks (Monday-anchored) with >= target satisfied days. */
function weeklyStreak(target: number, satisfied: Set<DayKey>, today: DayKey): number {
  const countInWeek = (monday: DayKey): number => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (satisfied.has(addDays(monday, i))) n++;
    return n;
  };

  const thisMonday = weekKeyOf(today);
  let streak = 0;
  // Current week counts if already satisfied; if not, it just doesn't break.
  if (countInWeek(thisMonday) >= target) streak++;

  let monday = addDays(thisMonday, -7);
  for (let i = 0; i < 530; i++) {
    if (countInWeek(monday) >= target) {
      streak++;
      monday = addDays(monday, -7);
    } else {
      break;
    }
  }
  return streak;
}
