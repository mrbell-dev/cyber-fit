// Recurring gig templates: pure spawn logic. repo.ts applies what this module
// decides — keep it engine-pure (no IO, clock values passed in via day keys).
import { weekdayOf, type DayKey } from "./time.ts";
import type { Gig, GigTemplate } from "./types.ts";

export const GIG_DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** Human cadence summary: "daily" or "Mo We Fr". */
export function cadenceLabel(days: number[]): string {
  if (days.length === 7) return "daily";
  return [...days].sort((a, b) => a - b).map((d) => GIG_DOW_LABELS[d]).join(" ");
}

/**
 * Templates that should spawn a fresh gig today: active, scheduled for today's
 * weekday, and not already represented on the board — either by a gig spawned
 * today (any state, so completing/migrating it doesn't resurrect a twin) or a
 * still-open rollover from a prior day (the rolled-over copy IS today's job).
 */
export function templatesDue(
  templates: GigTemplate[],
  gigs: Gig[],
  today: DayKey,
): GigTemplate[] {
  const dow = weekdayOf(today);
  const onBoard = new Set(
    gigs
      .filter((g) => g.templateId && (g.createdDay === today || (!g.doneTs && !g.retiredDay)))
      .map((g) => g.templateId as string),
  );
  return templates.filter((t) => !t.retiredTs && t.days.includes(dow) && !onBoard.has(t.id));
}
