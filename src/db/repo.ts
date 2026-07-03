// The ONLY write path to the database. UI components call these; nothing else
// writes. Reads happen via dexie-react-hooks useLiveQuery against `db` directly.
import {
  DEFAULT_SETTINGS,
  dayKeyFor,
  rebuild,
  type DayKey,
  type Habit,
  type HabitLog,
  type MoodLog,
  type PlayerState,
  type ReadingItem,
  type ReadingLog,
  type Schedule,
  type Settings,
  type WaterLog,
  type WorkoutLog,
} from "../engine/index.ts";
import { emitGrants } from "../ui/toast.ts";
import { db } from "./db.ts";

const SETTINGS_KEY = "settings";
const PLAYER_KEY = "player";

/**
 * Recompute PlayerState from ALL logs (deterministic full fold — snapshot can
 * never drift), persist it, and announce any newly earned grants.
 */
export async function refreshPlayer(): Promise<PlayerState> {
  const [habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs, settings, today, prevRow] =
    await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.waterLogs.toArray(),
      db.moodLogs.toArray(),
      db.workoutLogs.toArray(),
      db.readingLogs.toArray(),
      db.highlightLogs.toArray(),
      getSettings(),
      currentDayKey(),
      db.kv.get(PLAYER_KEY),
    ]);
  const { state, grants } = rebuild({
    habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs, settings, today,
  });
  await db.kv.put({ key: PLAYER_KEY, value: state });

  const prevKeys = new Set(((prevRow?.value as PlayerState | undefined)?.grantKeys) ?? []);
  emitGrants(grants.filter((g) => !prevKeys.has(g.key)));
  return state;
}

// ---------- time context (the one place the UI's clock enters the system) ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get(SETTINGS_KEY);
  // Backfill forward-compatibly: unknown fields kept, missing fields defaulted.
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await db.kv.put({ key: SETTINGS_KEY, value: next });
  return next;
}

export async function currentDayKey(): Promise<DayKey> {
  const { dayStartHour } = await getSettings();
  const now = Date.now();
  return dayKeyFor(now, new Date(now).getTimezoneOffset(), dayStartHour);
}

// ---------- habits ----------

export async function addHabit(input: {
  name: string;
  icon: string;
  schedule: Schedule;
  domain?: Habit["domain"];
  target?: number;
}): Promise<Habit> {
  const order = (await db.habits.count()) + 1;
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    icon: input.icon || "⚡",
    schedule: input.schedule,
    domain: input.domain ?? "general",
    target: Math.max(1, input.target ?? 1),
    createdAt: Date.now(),
    order,
  };
  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(id: string, patch: Partial<Omit<Habit, "id">>): Promise<void> {
  await db.habits.update(id, patch);
}

export async function archiveHabit(id: string): Promise<void> {
  await db.habits.update(id, { archivedAt: Date.now() });
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction("rw", db.habits, db.habitLogs, async () => {
    await db.habitLogs.where({ habitId: id }).delete();
    await db.habits.delete(id);
  });
}

// ---------- logging (append-only; undo = negative amount) ----------

export async function logHabit(
  habitId: string,
  opts: { kind?: HabitLog["kind"]; amount?: number; dayKey?: DayKey } = {},
): Promise<HabitLog> {
  const entry: HabitLog = {
    id: crypto.randomUUID(),
    habitId,
    dayKey: opts.dayKey ?? (await currentDayKey()),
    ts: Date.now(),
    amount: opts.kind === "skip" ? 0 : (opts.amount ?? 1),
    kind: opts.kind ?? "done",
  };
  await db.habitLogs.add(entry);
  await refreshPlayer();
  return entry;
}

/** Undo one completion for today (appends a −1; append-only history stays intact). */
export async function undoHabit(habitId: string, dayKey?: DayKey): Promise<void> {
  await logHabit(habitId, { amount: -1, dayKey });
}

export async function logWater(ml: number, dayKey?: DayKey): Promise<WaterLog> {
  const entry: WaterLog = {
    id: crypto.randomUUID(),
    dayKey: dayKey ?? (await currentDayKey()),
    ts: Date.now(),
    ml,
  };
  await db.waterLogs.add(entry);
  await refreshPlayer();
  return entry;
}

export async function logWorkout(input: {
  name: string;
  durationMin?: number;
  note?: string;
}): Promise<WorkoutLog> {
  const entry: WorkoutLog = {
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    name: input.name.trim(),
    ...(input.durationMin ? { durationMin: input.durationMin } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  await db.workoutLogs.add(entry);
  await refreshPlayer();
  return entry;
}

export async function addReadingItem(input: {
  title: string;
  author?: string;
  type: ReadingItem["type"];
}): Promise<ReadingItem> {
  const item: ReadingItem = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    ...(input.author?.trim() ? { author: input.author.trim() } : {}),
    type: input.type,
    status: "reading",
    createdAt: Date.now(),
  };
  await db.readingItems.add(item);
  return item;
}

export async function setReadingStatus(id: string, status: ReadingItem["status"]): Promise<void> {
  await db.readingItems.update(id, {
    status,
    ...(status === "finished" ? { finishedAt: Date.now() } : {}),
  });
}

export async function logReading(input: {
  itemId?: string;
  minutes?: number;
  note?: string;
  feeling?: ReadingLog["feeling"];
}): Promise<ReadingLog> {
  const entry: ReadingLog = {
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    ...(input.itemId ? { itemId: input.itemId } : {}),
    ...(input.minutes ? { minutes: input.minutes } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.feeling ? { feeling: input.feeling } : {}),
  };
  await db.readingLogs.add(entry);
  await refreshPlayer();
  return entry;
}

export async function logHighlight(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await db.highlightLogs.add({
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    text: trimmed,
  });
  await refreshPlayer();
}

export async function logMood(
  rating: MoodLog["rating"],
  opts: { energy?: MoodLog["energy"]; note?: string } = {},
): Promise<MoodLog> {
  const entry: MoodLog = {
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    rating,
    ...(opts.energy ? { energy: opts.energy } : {}),
    ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
  };
  await db.moodLogs.add(entry);
  await refreshPlayer();
  return entry;
}
