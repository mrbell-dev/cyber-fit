// Care-team export: a clean, professional Markdown summary of the last N days
// for a therapist or doctor. Sections are togglable per audience. Tone here is
// deliberately slang-free — this document represents the user to their care
// team. Generated entirely on-device; shared only by the user's own hand.

import { addDays, dayKeyFor, stripTags, waterTotal } from "../engine/index.ts";
import { db } from "./db.ts";
import { getSettings } from "./repo.ts";

export interface ReportSections {
  vitals: boolean;
  journals: boolean;
  highlights: boolean;
  bio: boolean;
  workouts: boolean;
  hydration: boolean;
  reading: boolean;
}

export const DEFAULT_SECTIONS: ReportSections = {
  vitals: true, journals: true, highlights: true,
  bio: false, workouts: true, hydration: false, reading: false,
};

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export async function buildReport(days: number, sections: ReportSections): Promise<string> {
  const settings = await getSettings();
  const now = Date.now();
  const today = dayKeyFor(now, new Date(now).getTimezoneOffset(), settings.dayStartHour);
  const from = addDays(today, -(days - 1));
  const inRange = <T extends { dayKey: string }>(rows: T[]) =>
    rows.filter((r) => r.dayKey >= from && r.dayKey <= today);

  const [moods, journals, highlights, bodyLogs, metrics, bioReadings, workouts, waterLogs, readingLogs, readingItems] =
    await Promise.all([
      db.moodLogs.toArray(), db.journalLogs.toArray(), db.highlightLogs.toArray(),
      db.bodyLogs.toArray(), db.bioMetrics.toArray(), db.bioReadings.toArray(),
      db.workoutLogs.toArray(), db.waterLogs.toArray(), db.readingLogs.toArray(),
      db.readingItems.toArray(),
    ]);

  const lines: string[] = [];
  lines.push(`# Self-tracking summary — ${from} to ${today}`);
  lines.push("");
  lines.push(
    `Generated ${new Date(now).toLocaleDateString()} from cyber-fit (self-reported data, ` +
    `logged day-by-day on the patient's own device).`,
  );
  lines.push("");

  // Overview: active days + mood shape.
  const rMoods = inRange(moods).sort((a, b) => a.ts - b.ts);
  const activeDays = new Set([
    ...inRange(moods).map((m) => m.dayKey),
    ...inRange(journals).map((j) => j.dayKey),
    ...inRange(highlights).map((h) => h.dayKey),
    ...inRange(workouts).map((w) => w.dayKey),
    ...inRange(waterLogs).map((w) => w.dayKey),
  ]);
  lines.push("## Overview");
  lines.push("");
  lines.push(`- Days with any logging: ${activeDays.size} of ${days}`);
  if (rMoods.length > 0) {
    const avg = (rMoods.reduce((s, m) => s + m.rating, 0) / rMoods.length).toFixed(1);
    const goodDays = new Set(rMoods.filter((m) => m.rating >= 4).map((m) => m.dayKey)).size;
    const hardDays = new Set(rMoods.filter((m) => m.rating <= 2).map((m) => m.dayKey)).size;
    lines.push(`- Mood check-ins: ${rMoods.length} (average ${avg}/5)`);
    lines.push(`- Days with a high reading (4–5): ${goodDays} · days with a low reading (1–2): ${hardDays}`);
  }
  lines.push("");

  if (sections.vitals && rMoods.length > 0) {
    lines.push("## Mood readings (1 = lowest, 5 = highest)");
    lines.push("");
    for (const m of rMoods) {
      lines.push(`- ${m.dayKey} ${fmtTime(m.ts)} — ${m.rating}/5${m.note ? ` — ${stripTags(m.note)}` : ""}`);
    }
    lines.push("");
  }

  if (sections.journals) {
    const rj = inRange(journals).sort((a, b) => a.ts - b.ts);
    if (rj.length > 0) {
      lines.push("## Journal entries");
      lines.push("");
      for (const j of rj) {
        lines.push(`**${j.dayKey} ${fmtTime(j.ts)}**`);
        lines.push("");
        lines.push(stripTags(j.text));
        lines.push("");
      }
    }
  }

  if (sections.highlights) {
    const rh = inRange(highlights).sort((a, b) => a.ts - b.ts);
    if (rh.length > 0) {
      lines.push("## Daily highlights (one good thing per day — savoring practice)");
      lines.push("");
      for (const h of rh) lines.push(`- ${h.dayKey} — ${stripTags(h.text)}`);
      lines.push("");
    }
  }

  if (sections.bio) {
    const rb = inRange(bodyLogs);
    const rr = inRange(bioReadings);
    if (rb.length > 0 || rr.length > 0) {
      lines.push("## Bio measurements");
      lines.push("");
      for (const b of rb) lines.push(`- ${b.dayKey} — weight ${b.weight} ${b.unit}`);
      const byMetric = new Map(metrics.map((m) => [m.id, m]));
      for (const r of rr.sort((a, b) => a.ts - b.ts)) {
        const m = byMetric.get(r.metricId);
        lines.push(`- ${r.dayKey} ${fmtTime(r.ts)} — ${m?.name ?? "metric"}: ${r.value}${m?.unit ? ` ${m.unit}` : ""}`);
      }
      lines.push("");
    }
  }

  if (sections.workouts) {
    const rw = inRange(workouts).sort((a, b) => a.ts - b.ts);
    if (rw.length > 0) {
      lines.push("## Physical activity");
      lines.push("");
      for (const w of rw) {
        const bits = [w.name, w.style, w.score, w.durationMin && `${w.durationMin} min`,
          w.distance && `${w.distance} ${settings.distanceUnit ?? "mi"}`].filter(Boolean);
        lines.push(`- ${w.dayKey} — ${bits.join(" · ")}`);
      }
      lines.push("");
    }
  }

  if (sections.hydration) {
    lines.push("## Hydration");
    lines.push("");
    let met = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(from, i);
      if (waterTotal(waterLogs.filter((l) => l.dayKey === d)) >= settings.waterGoalMl) met++;
    }
    lines.push(`- Daily goal met on ${met} of ${days} days`);
    lines.push("");
  }

  if (sections.reading) {
    const rl = inRange(readingLogs).sort((a, b) => a.ts - b.ts);
    if (rl.length > 0) {
      lines.push("## Reading / learning");
      lines.push("");
      const items = new Map(readingItems.map((i) => [i.id, i]));
      for (const l of rl) {
        const title = l.itemId ? items.get(l.itemId)?.title : undefined;
        lines.push(
          `- ${l.dayKey} — ${title ?? "session"}${l.minutes ? ` · ${l.minutes} min` : ""}` +
          `${l.note ? ` — ${stripTags(l.note)}` : ""}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("*Prepared by the patient for their care team. Data is self-reported.*");
  return lines.join("\n");
}

export function downloadReport(md: string, days: number): void {
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `care-team-summary-${days}d-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
