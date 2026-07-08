// Goals are a LENS over existing logs: this module derives progress toward a
// target and never writes. Pure — no Date.now()/Math.random()/tz reads here.
import { addDays, diffDays, weekKeyOf, type DayKey } from "./time.ts";
import { isScheduledOn } from "./habits.ts";
import type { Goal, Habit, HabitLog, ReadingLog, WorkoutLog } from "./types.ts";

export interface GoalTables {
  habitLogs: HabitLog[];
  readingLogs: ReadingLog[];
  workoutLogs: WorkoutLog[];
}

export interface GoalPeriod {
  startKey: DayKey;
  endKey: DayKey;
  /** start..today inclusive */
  elapsedDays: number;
  totalDays: number;
}

const daysBetweenInclusive = (a: DayKey, b: DayKey) => diffDays(a, b) + 1;

export function periodOf(horizon: Goal["horizon"], dayKey: DayKey): GoalPeriod {
  let startKey: DayKey, endKey: DayKey;
  const [y, m] = dayKey.split("-").map(Number);
  if (horizon === "week") {
    startKey = weekKeyOf(dayKey) as DayKey;
    endKey = addDays(startKey, 6);
  } else if (horizon === "month") {
    startKey = `${dayKey.slice(0, 7)}-01` as DayKey;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
    endKey = `${dayKey.slice(0, 7)}-${String(lastDay).padStart(2, "0")}` as DayKey;
  } else {
    startKey = `${y}-01-01` as DayKey;
    endKey = `${y}-12-31` as DayKey;
  }
  return {
    startKey,
    endKey,
    elapsedDays: daysBetweenInclusive(startKey, dayKey),
    totalDays: daysBetweenInclusive(startKey, endKey),
  };
}

const inRange = (k: DayKey, a: DayKey, b: DayKey) => k >= a && k <= b;

export function goalValue(goal: Goal, tables: GoalTables, startKey: DayKey, endKey: DayKey): number {
  if (goal.source.kind === "habits") {
    const ids = new Set(goal.source.habitIds);
    const net = tables.habitLogs
      .filter((l) => ids.has(l.habitId) && l.kind === "done" && inRange(l.dayKey, startKey, endKey))
      .reduce((sum, l) => sum + l.amount, 0);
    return Math.max(0, net);
  }
  if (goal.source.kind === "readingPages") {
    return tables.readingLogs
      .filter((l) => l.pages && inRange(l.dayKey, startKey, endKey))
      .reduce((sum, l) => sum + (l.pages ?? 0), 0);
  }
  return tables.workoutLogs.filter((l) => inRange(l.dayKey, startKey, endKey)).length;
}

export interface GoalProgress {
  value: number;
  target: number;
  expectedByNow: number;
  pace: "ahead" | "on" | "behind";
  daysLeft: number;
}

export function goalProgress(goal: Goal, tables: GoalTables, todayKey: DayKey): GoalProgress {
  const p = periodOf(goal.horizon, todayKey);
  const value = goalValue(goal, tables, p.startKey, p.endKey);
  // today itself doesn't count against pace yet — there's still time left in it
  const expectedByNow = goal.target * ((p.elapsedDays - 1) / p.totalDays);
  const pace = value < expectedByNow - 0.5 ? "behind" : value > expectedByNow + 0.5 ? "ahead" : "on";
  return { value, target: goal.target, expectedByNow, pace, daysLeft: p.totalDays - p.elapsedDays };
}

/** Is today safe to coast on this goal — behind on pace, but no linked
 *  directive is even scheduled today (so there's nothing to feel bad about skipping)? */
export function coastDay(goal: Goal, habits: Habit[], tables: GoalTables, todayKey: DayKey): boolean {
  if (goalProgress(goal, tables, todayKey).pace !== "behind") return false;
  if (goal.source.kind !== "habits") return true;
  const ids = new Set(goal.source.habitIds);
  return !habits.some((h) => ids.has(h.id) && !h.archivedAt && isScheduledOn(h, todayKey));
}
