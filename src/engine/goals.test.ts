import { describe, expect, it } from "vitest";
import { coastDay, goalProgress, goalValue, lastPeriodResult, periodOf } from "./goals.ts";
import type { Goal, Habit, HabitLog } from "./types.ts";

const g = (over: Partial<Goal> = {}): Goal => ({
  id: "g1", name: "Deep talks", horizon: "week", target: 4,
  source: { kind: "habits", habitIds: ["h1"] }, createdAt: 0, order: 1, ...over,
});
const hl = (dayKey: string, amount = 1, habitId = "h1"): HabitLog =>
  ({ id: "x", habitId, dayKey, ts: 0, amount, kind: "done" });
const T = (habitLogs: HabitLog[] = [], readingLogs: any[] = [], workoutLogs: any[] = [], goalLogs: any[] = []) =>
  ({ habitLogs, readingLogs, workoutLogs, goalLogs });
const gl = (dayKey: string, amount = 1, goalId = "g1") =>
  ({ id: `gl-${dayKey}`, goalId, dayKey, ts: 0, amount });

describe("periodOf", () => {
  it("week is Monday-anchored (2026-07-08 is a Wednesday)", () => {
    const p = periodOf("week", "2026-07-08");
    expect(p.startKey).toBe("2026-07-06");
    expect(p.endKey).toBe("2026-07-12");
    expect(p.elapsedDays).toBe(3);
    expect(p.totalDays).toBe(7);
  });
  it("month handles lengths and leap Feb", () => {
    expect(periodOf("month", "2026-02-10").totalDays).toBe(28);
    expect(periodOf("month", "2028-02-10").totalDays).toBe(29); // leap
    expect(periodOf("month", "2026-07-31").endKey).toBe("2026-07-31");
  });
  it("year", () => {
    const p = periodOf("year", "2026-07-08");
    expect(p.startKey).toBe("2026-01-01");
    expect(p.endKey).toBe("2026-12-31");
    expect(p.totalDays).toBe(365);
  });
});

describe("goalValue + pace", () => {
  it("habit counts net undo, only linked ids, only in period", () => {
    const logs = [hl("2026-07-06"), hl("2026-07-07"), hl("2026-07-07", -1),
                  hl("2026-07-07", 1, "other"), hl("2026-06-30")];
    expect(goalValue(g(), T(logs), "2026-07-06", "2026-07-12")).toBe(1);
  });
  it("pages sums only logs that have pages", () => {
    const goal = g({ source: { kind: "readingPages" }, horizon: "month", target: 100 });
    const rl = [{ dayKey: "2026-07-02", pages: 40 }, { dayKey: "2026-07-05", minutes: 20 },
                { dayKey: "2026-06-30", pages: 99 }];
    expect(goalValue(goal, T([], rl), "2026-07-01", "2026-07-31")).toBe(40);
  });
  it("pace has half-unit slack", () => {
    // Wed of week: expectedByNow = 4 * 3/7 ≈ 1.71 → behind < 1.21, ahead > 2.21
    expect(goalProgress(g(), T([hl("2026-07-06")]), "2026-07-08").pace).toBe("on");
    expect(goalProgress(g(), T([]), "2026-07-08").pace).toBe("behind");
    expect(goalProgress(g(), T([hl("2026-07-06"), hl("2026-07-07"), hl("2026-07-08")]),
                        "2026-07-08").pace).toBe("ahead");
    expect(goalProgress(g(), T([]), "2026-07-08").daysLeft).toBe(4);
  });
});

describe("lastPeriodResult", () => {
  it("counts only the previous week's logs", () => {
    // today 2026-07-08 (Wed) → current week starts 07-06, previous is 06-29..07-05
    const logs = [hl("2026-07-05"), hl("2026-06-29"), hl("2026-07-06"), hl("2026-06-28")];
    expect(lastPeriodResult(g(), T(logs), "2026-07-08")).toEqual({ value: 2, target: 4 });
  });
  it("previous month crosses the year boundary", () => {
    const goal = g({ horizon: "month", target: 10 });
    const logs = [hl("2025-12-31"), hl("2025-12-01"), hl("2026-01-01")];
    expect(lastPeriodResult(goal, T(logs), "2026-01-15")!.value).toBe(2);
  });
});

describe("manual source", () => {
  it("goalValue sums goalLogs in range, net of undos", () => {
    const goal = g({ source: { kind: "manual" }, target: 10 });
    const logs = [gl("2026-07-06", 1), gl("2026-07-07", 2), gl("2026-07-07", -1), gl("2026-06-30", 5)];
    expect(goalValue(goal, T([], [], [], logs), "2026-07-06", "2026-07-12")).toBe(2);
  });

  it("manual periodic goal paces like any other", () => {
    const goal = g({ source: { kind: "manual" }, target: 4 });
    const logs = [gl("2026-07-06"), gl("2026-07-07"), gl("2026-07-08")];
    expect(goalProgress(goal, T([], [], [], logs), "2026-07-08").pace).toBe("ahead");
  });
});

describe("lifelong + open-ended", () => {
  it("lifelong counts all-time, no pace, no deadline", () => {
    const goal = g({ horizon: "lifelong", target: undefined, source: { kind: "manual" } });
    const logs = [gl("2025-01-01"), gl("2026-07-01"), gl("2026-07-08")];
    const p = goalProgress(goal, T([], [], [], logs), "2026-07-08");
    expect(p.value).toBe(3);
    expect(p.pace).toBe("none");
    expect(p.lifelong).toBe(true);
    expect(p.openEnded).toBe(true); // no target
  });

  it("lifelong with a target still reports value + target, no pace", () => {
    const goal = g({ horizon: "lifelong", target: 100, source: { kind: "manual" } });
    const logs = [gl("2026-07-01"), gl("2026-07-08")];
    const p = goalProgress(goal, T([], [], [], logs), "2026-07-08");
    expect(p).toMatchObject({ value: 2, target: 100, pace: "none", openEnded: false, lifelong: true });
  });

  it("open-ended periodic goal: value within the period, no pace", () => {
    const goal = g({ horizon: "week", target: undefined, source: { kind: "manual" } });
    const logs = [gl("2026-07-06"), gl("2026-07-07"), gl("2026-06-29")];
    const p = goalProgress(goal, T([], [], [], logs), "2026-07-08");
    expect(p.value).toBe(2); // only this week
    expect(p.pace).toBe("none");
    expect(p.openEnded).toBe(true);
  });

  it("lastPeriodResult is null for lifelong (no previous period)", () => {
    const goal = g({ horizon: "lifelong", source: { kind: "manual" } });
    expect(lastPeriodResult(goal, T([], [], [], [gl("2026-07-01")]), "2026-07-08")).toBeNull();
  });
});

describe("coastDay", () => {
  const habit = (days: number[]): Habit => ({ id: "h1", name: "Lift", icon: "⚡",
    schedule: { kind: "weekdays", days }, domain: "general", target: 1, createdAt: 0, order: 1 });
  it("true when behind and no linked directive scheduled today", () => {
    expect(coastDay(g(), [habit([1, 5])], T([]), "2026-07-08")).toBe(true);  // Wed, gym Mon/Fri
    expect(coastDay(g(), [habit([3])], T([]), "2026-07-08")).toBe(false);    // Wed IS gym day
  });
  it("false when not behind; non-habit sources coast whenever behind", () => {
    expect(coastDay(g(), [habit([1, 5])], T([hl("2026-07-06")]), "2026-07-08")).toBe(false); // on pace
    const pages = g({ source: { kind: "readingPages" }, horizon: "month", target: 100 });
    expect(coastDay(pages, [], T([]), "2026-07-08")).toBe(true);
  });
  it("archived linked directives don't count as scheduled", () => {
    expect(coastDay(g(), [{ ...habit([3]), archivedAt: 1 }], T([]), "2026-07-08")).toBe(true);
  });
});
