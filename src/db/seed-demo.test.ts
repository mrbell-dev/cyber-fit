import { describe, expect, it } from "vitest";
import { EXPORT_VERSION } from "./export.ts";
import { dayKeyFor } from "../engine/time.ts";
// Plain-JS node script — no declaration file, vitest doesn't typecheck.
// @ts-expect-error
import { buildDemoExport, SEED_SCHEMA_VERSION } from "../../scripts/seed-demo.mjs";

const TABLES = [
  "habits", "habitLogs", "waterLogs", "moodLogs", "workoutLogs",
  "readingItems", "readingLogs", "highlightLogs", "bodyLogs", "journalLogs",
  "gigs", "bioMetrics", "bioReadings", "screenings", "goals", "tombstones", "kv",
] as const;

// Fixed local-time "now" so assertions are stable.
const FIXED_NOW = new Date("2026-07-10T15:00:00").getTime();
const demo = buildDemoExport(FIXED_NOW);

describe("demo profile export", () => {
  it("matches the live export schema version", () => {
    expect(SEED_SCHEMA_VERSION).toBe(EXPORT_VERSION);
    expect(demo.schemaVersion).toBe(EXPORT_VERSION);
    expect(demo.app).toBe("cyber-fit");
  });

  it("contains every export table as an array", () => {
    for (const name of TABLES) {
      expect(Array.isArray(demo.tables[name]), name).toBe(true);
    }
    expect(Object.keys(demo.tables).sort()).toEqual([...TABLES].sort());
  });

  it("uses unique ids everywhere", () => {
    const ids = TABLES.filter((t) => t !== "kv")
      .flatMap((t) => demo.tables[t].map((r: { id: string }) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("computes every dayKey via the engine's dayKeyFor", () => {
    for (const name of TABLES) {
      for (const row of demo.tables[name] as { dayKey?: string; ts?: number }[]) {
        if (row.dayKey === undefined) continue;
        const expected = dayKeyFor(row.ts!, new Date(row.ts!).getTimezoneOffset(), 3);
        expect(row.dayKey).toBe(expected);
      }
    }
  });

  it("keeps referential integrity", () => {
    const habitIds = new Set(demo.tables.habits.map((h: { id: string }) => h.id));
    for (const log of demo.tables.habitLogs) expect(habitIds.has(log.habitId)).toBe(true);
    const itemIds = new Set(demo.tables.readingItems.map((i: { id: string }) => i.id));
    for (const log of demo.tables.readingLogs) expect(itemIds.has(log.itemId)).toBe(true);
    const metricIds = new Set(demo.tables.bioMetrics.map((m: { id: string }) => m.id));
    for (const r of demo.tables.bioReadings) expect(metricIds.has(r.metricId)).toBe(true);
  });

  it("has streak texture: a 1-day gap and a ≥3-day reboot arc", () => {
    // Days-ago offsets each habit was logged "done".
    const byHabit = new Map<string, Set<number>>();
    const dayMs = 86_400_000;
    for (const log of demo.tables.habitLogs) {
      if (log.kind !== "done") continue;
      const off = Math.round((FIXED_NOW - log.ts) / dayMs);
      if (!byHabit.has(log.habitId)) byHabit.set(log.habitId, new Set());
      byHabit.get(log.habitId)!.add(off);
    }
    const gaps = [...byHabit.values()].map((days) => {
      let maxGap = 0;
      for (let d = 0; d < 21; d++) {
        let run = 0;
        while (d + run < 21 && !days.has(d + run)) run++;
        maxGap = Math.max(maxGap, run);
        d += run;
      }
      return maxGap;
    });
    expect(gaps.some((g) => g === 1)).toBe(true); // shield absorb
    expect(gaps.some((g) => g >= 3)).toBe(true); // reboot arc
  });

  it("suppresses first-run modals after import", () => {
    const kv = new Map(demo.tables.kv.map((r: { key: string; value: unknown }) => [r.key, r.value]));
    expect(kv.get("onboarded")).toBe(true);
    expect(typeof kv.get("lastBootDay")).toBe("string");
    expect(kv.get("settings")).toBeTruthy();
  });
});
