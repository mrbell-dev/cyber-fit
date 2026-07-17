import { describe, expect, it } from "vitest";
import { workoutBlocks, workoutParts, type WorkoutLog } from "./index.ts";

const base = { id: "1", dayKey: "2026-07-17", ts: 0 };

describe("workoutParts", () => {
  it("returns stored parts as-is (mixed session)", () => {
    const w: WorkoutLog = {
      ...base,
      name: "Tuesday workout",
      parts: [
        { style: "amrap", score: "12+5", durationMin: 20 },
        { style: "emom", score: "held", durationMin: 10 },
      ],
    };
    expect(workoutParts(w)).toEqual(w.parts);
  });

  it("synthesizes a sets block from legacy exercises", () => {
    const w: WorkoutLog = {
      ...base,
      name: "Lift",
      exercises: [{ name: "Lift", sets: [{ reps: 5, weight: 100 }] }],
    };
    expect(workoutParts(w)).toEqual([{ style: "sets", sets: [{ reps: 5, weight: 100 }] }]);
  });

  it("synthesizes a cardio block from legacy flat fields", () => {
    const w: WorkoutLog = { ...base, name: "5k", style: "cardio", durationMin: 30, distance: 3.1 };
    expect(workoutParts(w)).toEqual([{ style: "cardio", durationMin: 30, distance: 3.1 }]);
  });

  it("synthesizes a general block for a bare name-only log", () => {
    const w: WorkoutLog = { ...base, name: "Walk" };
    expect(workoutParts(w)).toEqual([{ style: "general" }]);
  });
});

describe("workoutBlocks", () => {
  it("returns block-model parts (with movements) as blocks", () => {
    const w: WorkoutLog = {
      ...base,
      name: "Metcon",
      parts: [
        {
          block: "Part A",
          style: "sets",
          movements: [{ name: "Back squat", sets: [{ reps: 5, weight: 225 }], weightUnit: "lbs" }],
        },
        { block: "Metcon", style: "amrap", score: "12+5", durationMin: 20, movements: [{ name: "Pull-ups", reps: 10 }] },
      ],
    };
    expect(workoutBlocks(w)).toEqual([
      {
        name: "Part A",
        style: "sets",
        movements: [{ name: "Back squat", sets: [{ reps: 5, weight: 225 }], weightUnit: "lbs" }],
      },
      { name: "Metcon", style: "amrap", score: "12+5", durationMin: 20, movements: [{ name: "Pull-ups", reps: 10 }] },
    ]);
  });

  it("keeps pre-block movement-parts as separate blocks (mixed session)", () => {
    const w: WorkoutLog = {
      ...base,
      name: "Tuesday",
      parts: [
        { style: "amrap", score: "12+5", durationMin: 20 },
        { style: "sets", name: "Back squat", sets: [{ reps: 5, weight: 100 }] },
      ],
    };
    expect(workoutBlocks(w)).toEqual([
      { style: "amrap", score: "12+5", durationMin: 20, movements: [] },
      { style: "sets", movements: [{ name: "Back squat", sets: [{ reps: 5, weight: 100 }] }] },
    ]);
  });

  it("regroups interim block-tagged movement-parts", () => {
    const w: WorkoutLog = {
      ...base,
      name: "Legs",
      parts: [
        { block: "A", style: "sets", name: "Squat", sets: [{ reps: 5 }] },
        { block: "A", style: "sets", name: "Lunge", sets: [{ reps: 8 }] },
      ],
    };
    expect(workoutBlocks(w)).toEqual([
      {
        name: "A",
        style: "sets",
        movements: [
          { name: "Squat", sets: [{ reps: 5 }] },
          { name: "Lunge", sets: [{ reps: 8 }] },
        ],
      },
    ]);
  });

  it("folds a legacy flat log into one block", () => {
    const w: WorkoutLog = { ...base, name: "5k", style: "cardio", durationMin: 30, distance: 3.1 };
    expect(workoutBlocks(w)).toEqual([{ style: "cardio", durationMin: 30, distance: 3.1, movements: [] }]);
  });
});
