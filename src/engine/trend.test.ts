import { describe, expect, it } from "vitest";
import { moodTrend, screenerTrend, trendDirection } from "./trend.ts";
import type { MoodLog, Screening } from "./types.ts";

const mood = (dayKey: string, rating: MoodLog["rating"], ts = 0): MoodLog => ({
  id: `${dayKey}-${ts}`, dayKey, ts, rating,
});

const scr = (dayKey: string, tool: Screening["tool"], score: number, ts = 0): Screening => ({
  id: `${dayKey}-${tool}-${ts}`, dayKey, ts, tool, score, answers: [],
});

describe("moodTrend", () => {
  it("averages multiple check-ins per day and sorts by day", () => {
    const logs = [
      mood("2026-07-14", 4, 2),
      mood("2026-07-14", 2, 1),
      mood("2026-07-12", 5),
    ];
    expect(moodTrend(logs, "2026-07-14", 30)).toEqual([
      { dayKey: "2026-07-12", value: 5 },
      { dayKey: "2026-07-14", value: 3 },
    ]);
  });

  it("excludes logs outside the window and omits empty days", () => {
    const logs = [mood("2026-06-01", 1), mood("2026-07-13", 4)];
    const pts = moodTrend(logs, "2026-07-14", 30);
    expect(pts).toEqual([{ dayKey: "2026-07-13", value: 4 }]);
  });
});

describe("screenerTrend", () => {
  it("filters by tool, keeps latest same-day retake, sorts oldest first", () => {
    const rows = [
      scr("2026-07-10", "phq9", 14, 1),
      scr("2026-07-10", "phq9", 12, 2), // retake supersedes
      scr("2026-07-01", "phq9", 18),
      scr("2026-07-05", "gad7", 9),
    ];
    expect(screenerTrend(rows, "phq9")).toEqual([
      { dayKey: "2026-07-01", value: 18 },
      { dayKey: "2026-07-10", value: 12 },
    ]);
  });
});

describe("trendDirection", () => {
  const pts = (...vals: number[]) =>
    vals.map((value, i) => ({ dayKey: `2026-07-${String(i + 1).padStart(2, "0")}`, value }));

  it("needs at least 3 points", () => {
    expect(trendDirection(pts(1, 5), 0.3)).toBeNull();
  });

  it("rising mood is improving; rising screener score is worsening", () => {
    expect(trendDirection(pts(2, 2, 4, 4), 0.3)).toBe("improving");
    expect(trendDirection(pts(8, 9, 14, 15), 1, true)).toBe("worsening");
  });

  it("falling screener score is improving", () => {
    expect(trendDirection(pts(18, 14, 10, 9), 1, true)).toBe("improving");
  });

  it("small deltas inside epsilon are steady", () => {
    expect(trendDirection(pts(3, 3.1, 3, 3.2), 0.3)).toBe("steady");
  });
});
