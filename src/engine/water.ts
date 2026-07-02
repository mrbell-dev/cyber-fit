import type { WaterLog } from "./types.ts";

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
