import { describe, expect, it } from "vitest";
import { medWindow } from "./meds.ts";
import type { Habit, HabitLog } from "./types.ts";

const OFF = 300; // EST, no DST in these fixtures
const local = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) + OFF * 60_000; // localtime → epoch ms

const daily: Habit = {
  id: "m1", name: "Focus med", icon: "💊", schedule: { kind: "daily" },
  domain: "general", target: 1, createdAt: 0, order: 1, area: "meds",
  med: { dueTime: "09:00", remindEveryMin: 30, windowMin: 240 },
};
const weekly: Habit = {
  ...daily, id: "m2", name: "Weekly shot", schedule: { kind: "weekdays", days: [5] },
  med: { dueTime: "18:00", remindEveryMin: 120, windowMin: 1440 },
};
const done = (ts: number): HabitLog =>
  ({ id: "l", habitId: "m1", dayKey: "x", ts, amount: 1, kind: "done" });

describe("medWindow", () => {
  it("null for non-med habits", () => {
    expect(medWindow({ ...daily, med: undefined }, local(2026, 7, 8, 10), OFF, [])).toBeNull();
  });
  it("upcoming before dueTime, open inside, closed after", () => {
    // 2026-07-08 is a Wednesday
    expect(medWindow(daily, local(2026, 7, 8, 8), OFF, [])!.state).toBe("upcoming");
    const w = medWindow(daily, local(2026, 7, 8, 10), OFF, [])!;
    expect(w.state).toBe("open");
    expect(w.anchorDayKey).toBe("2026-07-08");
    expect(w.closesAt).toBe(local(2026, 7, 8, 13));
    expect(medWindow(daily, local(2026, 7, 8, 13, 1), OFF, [])!.state).toBe("closed");
  });
  it("taken when a done log lands inside the window; undo (net ≤0) reopens", () => {
    const logs = [{ ...done(local(2026, 7, 8, 9, 30)), habitId: "m1" }];
    expect(medWindow(daily, local(2026, 7, 8, 10), OFF, logs)!.state).toBe("taken");
    const undo = [...logs, { ...done(local(2026, 7, 8, 9, 40)), amount: -1 }];
    expect(medWindow(daily, local(2026, 7, 8, 10), OFF, undo)!.state).toBe("open");
  });
  it("weekly 24h window crosses midnight and anchors to the scheduled day", () => {
    // Fri 2026-07-10 18:00 → Sat 2026-07-11 18:00
    const w = medWindow(weekly, local(2026, 7, 11, 10), OFF, [])!; // Sat morning
    expect(w.state).toBe("open");
    expect(w.anchorDayKey).toBe("2026-07-10");
    const taken = medWindow(weekly, local(2026, 7, 11, 10), OFF,
      [{ ...done(local(2026, 7, 11, 9)), habitId: "m2" }])!;
    expect(taken.state).toBe("taken");
    expect(medWindow(weekly, local(2026, 7, 11, 18, 1), OFF, [])!.state).toBe("closed");
    // Wednesday, nowhere near the slot → upcoming toward Friday
    expect(medWindow(weekly, local(2026, 7, 8, 10), OFF, [])!.state).toBe("upcoming");
  });
});
