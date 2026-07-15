// Trend helpers — pure functions over logs, for the Telemetry charts and the
// care-team export. No smoothing tricks: care teams want the real shape of the
// data, not a flattering curve. Days without readings are simply absent
// (charts connect across gaps; a gap is not a zero mood).

import type { MoodLog, Screening } from "./types.ts";
import { addDays, type DayKey } from "./time.ts";

export interface TrendPoint {
  dayKey: DayKey;
  value: number;
}

/** Average mood rating per day over the last `windowDays` days ending at
 *  `today`, in day order. Days with no check-in are omitted. */
export function moodTrend(logs: MoodLog[], today: DayKey, windowDays: number): TrendPoint[] {
  const from = addDays(today, -(windowDays - 1));
  const byDay = new Map<DayKey, { sum: number; n: number }>();
  for (const l of logs) {
    if (l.dayKey < from || l.dayKey > today) continue;
    const cur = byDay.get(l.dayKey) ?? { sum: 0, n: 0 };
    cur.sum += l.rating;
    cur.n += 1;
    byDay.set(l.dayKey, cur);
  }
  return [...byDay.entries()]
    .map(([dayKey, { sum, n }]) => ({ dayKey, value: sum / n }))
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
}

/** Screener scores over time for one tool, oldest first. Multiple takes on
 *  one day keep the latest (a retake supersedes). */
export function screenerTrend(rows: Screening[], tool: Screening["tool"]): TrendPoint[] {
  const byDay = new Map<DayKey, Screening>();
  for (const s of rows) {
    if (s.tool !== tool) continue;
    const prev = byDay.get(s.dayKey);
    if (!prev || s.ts > prev.ts) byDay.set(s.dayKey, s);
  }
  return [...byDay.values()]
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1))
    .map((s) => ({ dayKey: s.dayKey, value: s.score }));
}

/** Plain-English direction for the export. Compares the mean of the first and
 *  last halves of the series; `epsilon` is the "call it steady" dead zone,
 *  expressed in the series' own units. Returns null below 3 points —
 *  two dots make a line, not a trend. */
export function trendDirection(
  points: TrendPoint[],
  epsilon: number,
  /** true when a falling number is the good direction (PHQ-9/GAD-7) */
  lowerIsBetter = false,
): "improving" | "steady" | "worsening" | null {
  if (points.length < 3) return null;
  const half = Math.floor(points.length / 2);
  const mean = (ps: TrendPoint[]) => ps.reduce((s, p) => s + p.value, 0) / ps.length;
  const delta = mean(points.slice(-half)) - mean(points.slice(0, half));
  if (Math.abs(delta) <= epsilon) return "steady";
  const rising = delta > 0;
  return rising === !lowerIsBetter ? "improving" : "worsening";
}
