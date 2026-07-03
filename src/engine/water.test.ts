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

describe("units", () => {
  it("oz conversions round-trip within rounding", async () => {
    const { mlToOz, ozToMl, formatWater, waterQuickSizes } = await import("./water.ts");
    expect(ozToMl(128)).toBe(3785); // Michael's daily goal
    expect(mlToOz(3785)).toBe(128);
    expect(formatWater(3785, "oz")).toBe("128 oz");
    expect(formatWater(500, "ml")).toBe("500 ml");
    expect(waterQuickSizes("oz").map((s) => s.label)).toEqual(["+8 oz", "+16 oz"]);
  });
});
