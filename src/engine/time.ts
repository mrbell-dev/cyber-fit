// Day-boundary math. Every log stores its dayKey AT LOG TIME so later timezone
// changes never rewrite history. All streak/schedule logic operates on dayKeys only.

export type DayKey = string; // "2026-07-02"

export interface TimeCtx {
  /** epoch ms "now" — injected, never Date.now() inside the engine */
  now: number;
  /** minutes to ADD to local time to reach UTC (JS Date#getTimezoneOffset convention) */
  tzOffsetMinutes: number;
  /** hour (0-23) at which a new "day" starts; default 3 → a 1 AM log counts as yesterday */
  dayStartHour: number;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

/** dayKey for a timestamp, honoring timezone + dayStartHour. */
export function dayKeyFor(ts: number, tzOffsetMinutes: number, dayStartHour: number): DayKey {
  const localMs = ts - tzOffsetMinutes * MIN_MS - dayStartHour * HOUR_MS;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(ctx: TimeCtx): DayKey {
  return dayKeyFor(ctx.now, ctx.tzOffsetMinutes, ctx.dayStartHour);
}

/** dayKey ± n days (calendar-safe: operates on UTC-noon to dodge DST edges). */
export function addDays(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split("-").map(Number);
  const noon = Date.UTC(y, m - 1, d, 12);
  const shifted = new Date(noon + n * DAY_MS);
  const ny = shifted.getUTCFullYear();
  const nm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/** b - a in whole days (positive when b is after a). */
export function diffDays(a: DayKey, b: DayKey): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** ISO weekday of a dayKey: 0=Sunday … 6=Saturday (matches Habit.schedule.days). */
export function weekdayOf(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday-anchored week id ("2026-W27"-style key) for timesPerWeek streaks. */
export function weekKeyOf(key: DayKey): string {
  const wd = weekdayOf(key); // 0=Sun
  const daysSinceMonday = (wd + 6) % 7;
  return addDays(key, -daysSinceMonday); // the Monday's dayKey identifies the week
}
