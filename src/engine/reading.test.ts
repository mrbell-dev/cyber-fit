import { describe, expect, it } from "vitest";
import { daySetStreak, learningDays, readingDays } from "./reading.ts";
import { rebuild, type LogBundle } from "./rebuild.ts";
import { DEFAULT_SETTINGS, type Habit, type ReadingLog, type WorkoutLog } from "./types.ts";
import { addDays } from "./time.ts";

const TODAY = "2026-07-02";

const learnHabit: Habit = {
  id: "L1", name: "Practice guitar", icon: "🎸", schedule: { kind: "daily" },
  domain: "learning", target: 1, createdAt: 0, order: 0,
};

const rlog = (id: string, dayKey: string, note?: string): ReadingLog => ({
  id, dayKey, ts: 100, ...(note ? { note } : {}),
});
const wlog = (id: string, dayKey: string): WorkoutLog => ({ id, dayKey, ts: 100, name: "Lift" });

function bundle(partial: Partial<LogBundle>): LogBundle {
  return {
    habits: [learnHabit], habitLogs: [], waterLogs: [], moodLogs: [],
    workoutLogs: [], readingLogs: [], settings: DEFAULT_SETTINGS, today: TODAY,
    ...partial,
  };
}

describe("daySetStreak", () => {
  it("consecutive days; today missing never breaks", () => {
    expect(daySetStreak(new Set([addDays(TODAY, -1), addDays(TODAY, -2)]), TODAY)).toBe(2);
    expect(daySetStreak(new Set([TODAY, addDays(TODAY, -1)]), TODAY)).toBe(2);
    expect(daySetStreak(new Set([addDays(TODAY, -2)]), TODAY)).toBe(0);
  });
});

describe("learning/reading day sets", () => {
  it("reading sessions count for both", () => {
    const logs = [rlog("r1", TODAY)];
    expect(readingDays(logs).has(TODAY)).toBe(true);
    expect(learningDays([], [], logs).has(TODAY)).toBe(true);
  });

  it("learning habit done counts for learning only", () => {
    const habitLogs = [{ id: "a", habitId: "L1", dayKey: TODAY, ts: 1, amount: 1, kind: "done" as const }];
    expect(learningDays([learnHabit], habitLogs, []).has(TODAY)).toBe(true);
    expect(readingDays([]).has(TODAY)).toBe(false);
  });
});

describe("rebuild — workout + reading XP", () => {
  it("workout grants, capped at 2/day", () => {
    const { grants } = rebuild(bundle({
      workoutLogs: [wlog("w1", TODAY), wlog("w2", TODAY), wlog("w3", TODAY)],
    }));
    expect(grants.filter((g) => g.source === "workout")).toHaveLength(2);
  });

  it("reading session with note earns the note bonus within the cap", () => {
    const { grants } = rebuild(bundle({ readingLogs: [rlog("r1", TODAY, "great chapter")] }));
    const reading = grants.filter((g) => g.source === "reading");
    expect(reading).toHaveLength(2); // session + note
  });
});
