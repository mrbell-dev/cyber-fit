import Dexie, { type EntityTable } from "dexie";
import type {
  BioMetric,
  Screening,
  BioReading,
  BodyLog,
  Gig,
  Goal,
  GoalLog,
  Habit,
  JournalLog,
  HabitLog,
  HighlightLog,
  MoodLog,
  ReadingItem,
  ReadingLog,
  WaterLog,
  WorkoutLog,
} from "../engine/index.ts";

// Discipline: NEVER edit a shipped version(n) — append version(n+1) with an
// upgrade function instead. engine/rebuild.ts is the repair escape hatch.

export interface KvRow {
  key: string;
  value: unknown;
}

/** A deletion, remembered. id = the deleted row's id (UUIDs never collide
 *  across tables, but `table` is kept so merge knows where to delete). */
export interface Tombstone {
  id: string;
  table: string;
  ts: number;
}

export const db = new Dexie("cyber-fit") as Dexie & {
  habits: EntityTable<Habit, "id">;
  habitLogs: EntityTable<HabitLog, "id">;
  waterLogs: EntityTable<WaterLog, "id">;
  moodLogs: EntityTable<MoodLog, "id">;
  workoutLogs: EntityTable<WorkoutLog, "id">;
  readingItems: EntityTable<ReadingItem, "id">;
  readingLogs: EntityTable<ReadingLog, "id">;
  highlightLogs: EntityTable<HighlightLog, "id">;
  bodyLogs: EntityTable<BodyLog, "id">;
  journalLogs: EntityTable<JournalLog, "id">;
  gigs: EntityTable<Gig, "id">;
  bioMetrics: EntityTable<BioMetric, "id">;
  bioReadings: EntityTable<BioReading, "id">;
  screenings: EntityTable<Screening, "id">;
  kv: EntityTable<KvRow, "key">;
  goals: EntityTable<Goal, "id">;
  goalLogs: EntityTable<GoalLog, "id">;
  tombstones: EntityTable<Tombstone, "id">;
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

db.version(3).stores({
  workoutLogs: "id, dayKey",
  readingItems: "id, status",
  readingLogs: "id, dayKey, itemId",
});

db.version(4).stores({
  highlightLogs: "id, dayKey",
});

db.version(5).stores({
  bodyLogs: "id, dayKey",
});

db.version(7).stores({
  screenings: "id, dayKey, tool",
});

db.version(6).stores({
  journalLogs: "id, dayKey",
  gigs: "id, createdDay, doneDay",
  bioMetrics: "id",
  bioReadings: "id, metricId, dayKey, [metricId+dayKey]",
});

db.version(8).stores({
  goals: "id, order",
});

db.version(9).stores({
  tombstones: "id, table",
});

db.version(10).stores({
  goalLogs: "id, goalId, dayKey",
});
