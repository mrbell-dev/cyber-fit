import Dexie, { type EntityTable } from "dexie";
import type { Habit, HabitLog, MoodLog, WaterLog } from "../engine/index.ts";

// Discipline: NEVER edit a shipped version(n) — append version(n+1) with an
// upgrade function instead. engine/rebuild.ts is the repair escape hatch.

export interface KvRow {
  key: string;
  value: unknown;
}

export const db = new Dexie("cyber-fit") as Dexie & {
  habits: EntityTable<Habit, "id">;
  habitLogs: EntityTable<HabitLog, "id">;
  waterLogs: EntityTable<WaterLog, "id">;
  moodLogs: EntityTable<MoodLog, "id">;
  kv: EntityTable<KvRow, "key">;
};

db.version(1).stores({
  habits: "id, order, archivedAt",
  habitLogs: "id, habitId, dayKey, [habitId+dayKey]",
  waterLogs: "id, dayKey",
  kv: "key",
});

db.version(2).stores({
  moodLogs: "id, dayKey",
});
