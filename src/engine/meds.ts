// Medication dose windows. Pure: clock + tz injected, no Date.now().
// A med's window opens at dueTime on each scheduled day and closes
// windowMin later (may cross midnight — the weekly-shot case).
import type { DayKey } from "./time.ts";
import type { Habit, HabitLog } from "./types.ts";

export interface MedWindow {
  state: "upcoming" | "open" | "taken" | "closed";
  opensAt: number;   // epoch ms
  closesAt: number;  // epoch ms
  anchorDayKey: DayKey; // the scheduled day — logs inside the window use THIS
}

const DAY_MS = 86_400_000;

function scheduledOn(habit: Habit, weekday: number): boolean {
  return habit.schedule.kind === "weekdays" ? habit.schedule.days.includes(weekday) : true;
}

function dayKeyOf(dayStart: number): DayKey {
  const d = new Date(dayStart);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}` as DayKey;
}

// A log counts toward a window's net if it carries the window's anchor
// dayKey (however it wrote it can undo/redo, including after close — the
// UI always writes undos with the anchor dayKey and a real Date.now() ts,
// so a post-close undo must still be visible) OR its ts falls inside
// [opensAt, closesAt) (an early dose logged before the window opens still
// counts as taken). Each log is counted once even if both are true.
function takenState(
  habit: Habit, opensAt: number, closesAt: number, anchorDayKey: DayKey, nowMs: number, logs: HabitLog[],
): MedWindow {
  const net = logs
    .filter((l) => l.habitId === habit.id && l.kind === "done" &&
      (l.dayKey === anchorDayKey || (l.ts >= opensAt && l.ts < closesAt)))
    .reduce((a, l) => a + l.amount, 0);
  if (net > 0) return { state: "taken", opensAt, closesAt, anchorDayKey };
  return { state: nowMs < closesAt ? "open" : "closed", opensAt, closesAt, anchorDayKey };
}

/** Window whose anchor is the most recent scheduled day at dueTime that is
 *  not after `now` — or, if none is in progress, the state relative to the
 *  nearest one (upcoming before today's open; closed after the last close).
 *
 *  The most recent scheduled day is only "current" if its window's closesAt
 *  falls on or after the start of today — i.e. it's today's window, or a
 *  cross-midnight window from yesterday that closes today. Anything older is
 *  stale and we look forward to the next scheduled occurrence instead.
 *
 *  Taken-ness: a window's net counts `kind:"done"` logs for the habit where
 *  EITHER `dayKey === anchorDayKey` OR `ts` falls in `[opensAt, closesAt)`
 *  (each log counted once, even if both hold). The dayKey clause makes undo
 *  safe after the window closes — the UI always writes undo taps with the
 *  window's anchor dayKey but a real Date.now() ts, so without it a post-close
 *  undo would be invisible and the state would stay "taken" forever while every
 *  further tap silently stacks another log on the anchor day. The ts clause
 *  makes an early dose (logged before the window opens, e.g. a 7am tap for a
 *  9am med) count as taken immediately instead of showing "upcoming" and still
 *  firing reminders. */
export function medWindow(
  habit: Habit, nowMs: number, tzOffsetMin: number, logs: HabitLog[],
): MedWindow | null {
  if (!habit.med) return null;
  const { dueTime, windowMin } = habit.med;
  const [hh, mm] = dueTime.split(":").map(Number);
  const localNow = nowMs - tzOffsetMin * 60_000; // "UTC-labeled" local instant
  const todayStart = Math.floor(localNow / DAY_MS) * DAY_MS;

  // Walk back to the most recent scheduled day — up to 8 days, since
  // scheduled days can be a week apart (a weekly shot).
  for (let back = 0; back < 8; back++) {
    const dayStart = todayStart - back * DAY_MS;
    const d = new Date(dayStart);
    if (!scheduledOn(habit, d.getUTCDay())) continue;
    const opensAt = dayStart + (hh * 60 + mm) * 60_000 + tzOffsetMin * 60_000; // back to epoch
    const closesAt = opensAt + windowMin * 60_000;
    const anchorDayKey = dayKeyOf(dayStart);
    if (closesAt <= todayStart) break; // stale — fall through to the forward-search
    if (nowMs < opensAt) {
      const taken = takenState(habit, opensAt, closesAt, anchorDayKey, nowMs, logs);
      if (taken.state === "taken") return taken; // early dose logged before open
      return { state: "upcoming", opensAt, closesAt, anchorDayKey };
    }
    return takenState(habit, opensAt, closesAt, anchorDayKey, nowMs, logs);
  }

  // No live/recent scheduled day — find the next upcoming occurrence.
  for (let fwd = 1; fwd < 8; fwd++) {
    const dayStart = todayStart + fwd * DAY_MS;
    const d = new Date(dayStart);
    if (!scheduledOn(habit, d.getUTCDay())) continue;
    const opensAt = dayStart + (hh * 60 + mm) * 60_000 + tzOffsetMin * 60_000;
    const anchorDayKey = dayKeyOf(dayStart);
    return { state: "upcoming", opensAt, closesAt: opensAt + windowMin * 60_000, anchorDayKey };
  }
  return null;
}
