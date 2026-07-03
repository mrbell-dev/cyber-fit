import type { WaterLog } from "./types.ts";

// Storage is ALWAYS ml (canonical); oz is a display/input unit.
export const OZ_IN_ML = 29.5735;

export function mlToOz(ml: number): number {
  return Math.round(ml / OZ_IN_ML);
}

export function ozToMl(oz: number): number {
  return Math.round(oz * OZ_IN_ML);
}

/** Quick-add button sizes per unit (US-friendly 8/16 oz; metric 250/500 ml). */
export function waterQuickSizes(unit: "ml" | "oz"): { label: string; ml: number }[] {
  return unit === "oz"
    ? [
        { label: "+8 oz", ml: ozToMl(8) },
        { label: "+16 oz", ml: ozToMl(16) },
      ]
    : [
        { label: "+250", ml: 250 },
        { label: "+500", ml: 500 },
      ];
}

export function formatWater(ml: number, unit: "ml" | "oz"): string {
  return unit === "oz" ? `${mlToOz(ml)} oz` : `${ml} ml`;
}

/** Total ml for a day's logs (negative entries are undos; never below 0). */
export function waterTotal(logs: WaterLog[]): number {
  return Math.max(
    0,
    logs.reduce((sum, l) => sum + l.ml, 0),
  );
}

export function waterGoalMet(logs: WaterLog[], goalMl: number): boolean {
  return waterTotal(logs) >= goalMl;
}
