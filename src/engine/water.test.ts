import { describe, expect, it } from "vitest";
import { waterGoalMet, waterTotal } from "./water.ts";
import type { WaterLog } from "./types.ts";

const ml = (n: number): WaterLog => ({ id: String(n), dayKey: "2026-07-02", ts: 0, ml: n });

describe("water", () => {
  it("sums and clamps at zero", () => {
    expect(waterTotal([ml(250), ml(500)])).toBe(750);
    expect(waterTotal([ml(250), ml(-500)])).toBe(0);
    expect(waterTotal([])).toBe(0);
  });

  it("goal check", () => {
    expect(waterGoalMet([ml(2000)], 2000)).toBe(true);
    expect(waterGoalMet([ml(1999)], 2000)).toBe(false);
  });
});
