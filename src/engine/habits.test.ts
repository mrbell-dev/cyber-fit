import { describe, expect, it } from "vitest";
import { dayStatus, habitStreak, isScheduledOn } from "./habits.ts";
import type { Habit, HabitLog } from "./types.ts";
import { addDays } from "./time.ts";

const base = { id: "h1", name: "Test", icon: "⚡", domain: "general" as const, target: 1, createdAt: 0, order: 0 };
const daily: Habit = { ...base, schedule: { kind: "daily" } };
const weekdays: Habit = { ...base, schedule: { kind: "weekdays", days: [1, 3, 5] } }; // Mon/Wed/Fri
const thriceWeekly: Habit = { ...base, schedule: { kind: "timesPerWeek", target: 3 } };

const log = (dayKey: string, amount = 1, kind: "done" | "skip" = "done"): HabitLog => ({
  id: `${dayKey}-${Math.abs(amount)}`, habitId: "h1", dayKey, ts: 0, amount, kind,
});

// 2026-07-02 is a Thursday.
const TODAY = "2026-07-02";

describe("isScheduledOn", () => {
  it("weekdays schedule", () => {
    expect(isScheduledOn(weekdays, "2026-07-01")).toBe(true); // Wed
    expect(isScheduledOn(weekdays, "2026-07-02")).toBe(false); // Thu
  });
});

describe("dayStatus", () => {
  it("sums amounts and honors target", () => {
    const h = { ...daily, target: 3 };
    expect(dayStatus(h, [log(TODAY), log(TODAY)])).toEqual({ count: 2, done: false, skipped: false });
    expect(dayStatus(h, [log(TODAY), log(TODAY), log(TODAY)]).done).toBe(true);
  });

  it("negative amounts undo, never below zero", () => {
    expect(dayStatus(daily, [log(TODAY, 1), log(TODAY, -1), log(TODAY, -1)]).count).toBe(0);
  });

  it("skip is tracked separately", () => {
    expect(dayStatus(daily, [log(TODAY, 0, "skip")])).toEqual({ count: 0, done: false, skipped: true });
  });
});

describe("habitStreak — daily", () => {
  it("counts consecutive days, today-in-progress doesn't break", () => {
    const sat = new Set([addDays(TODAY, -1), addDays(TODAY, -2), addDays(TODAY, -3)]);
    expect(habitStreak(daily, sat, new Set(), TODAY)).toBe(3);
  });

  it("today done extends", () => {
    const sat = new Set([TODAY, addDays(TODAY, -1)]);
    expect(habitStreak(daily, sat, new Set(), TODAY)).toBe(2);
  });

  it("a gap breaks it", () => {
    const sat = new Set([addDays(TODAY, -1), addDays(TODAY, -3)]);
    expect(habitStreak(daily, sat, new Set(), TODAY)).toBe(1);
  });

  it("skip preserves but doesn't extend", () => {
    const sat = new Set([addDays(TODAY, -1), addDays(TODAY, -3)]);
    const skip = new Set([addDays(TODAY, -2)]);
    expect(habitStreak(daily, sat, skip, TODAY)).toBe(2);
  });
});

describe("habitStreak — weekdays", () => {
  it("unscheduled days never break", () => {
    // Mon/Wed/Fri habit; done Mon 6/29 + Wed 7/1; today Thu 7/2 unscheduled.
    const sat = new Set(["2026-06-29", "2026-07-01"]);
    expect(habitStreak(weekdays, sat, new Set(), TODAY)).toBe(2);
  });

  it("missed scheduled day breaks", () => {
    // Missed Wed 7/1, did Mon 6/29.
    const sat = new Set(["2026-06-29"]);
    expect(habitStreak(weekdays, sat, new Set(), TODAY)).toBe(0);
  });
});

describe("habitStreak — nPerX (rolling window)", () => {
  const monthly: Habit = { ...base, schedule: { kind: "nPerX", times: 1, periodDays: 30 } };

  it("1-per-30-days chains across periods", () => {
    // one hit in current window, one in the prior window
    const sat = new Set([addDays(TODAY, -5), addDays(TODAY, -40)]);
    expect(habitStreak(monthly, sat, new Set(), TODAY)).toBe(2);
  });

  it("empty current window doesn't break; empty prior window does", () => {
    const onlyPrior = new Set([addDays(TODAY, -40)]);
    expect(habitStreak(monthly, onlyPrior, new Set(), TODAY)).toBe(1);
    const gap = new Set([addDays(TODAY, -5), addDays(TODAY, -80)]);
    expect(habitStreak(monthly, gap, new Set(), TODAY)).toBe(1);
  });
});

describe("habitStreak — timesPerWeek", () => {
  it("current week satisfied counts; prior weeks chain", () => {
    // Week of 6/22 (Mon): 3 days done. Week of 6/29: 3 days done.
    const sat = new Set([
      "2026-06-22", "2026-06-24", "2026-06-26",
      "2026-06-29", "2026-06-30", "2026-07-01",
    ]);
    expect(habitStreak(thriceWeekly, sat, new Set(), TODAY)).toBe(2);
  });

  it("current week in progress doesn't break the chain", () => {
    // Last week satisfied, this week only 1 day so far → streak stays 1.
    const sat = new Set(["2026-06-22", "2026-06-24", "2026-06-26", "2026-06-30"]);
    expect(habitStreak(thriceWeekly, sat, new Set(), TODAY)).toBe(1);
  });
});
