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
  const [habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs, bodyLogs, journalLogs, gigs, bioReadings, settings, today, prevRow] =
    await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.waterLogs.toArray(),
      db.moodLogs.toArray(),
      db.workoutLogs.toArray(),
      db.readingLogs.toArray(),
      db.highlightLogs.toArray(),
      db.bodyLogs.toArray(),
      db.journalLogs.toArray(),
      db.gigs.toArray(),
      db.bioReadings.toArray(),
      getSettings(),
      currentDayKey(),
      db.kv.get(PLAYER_KEY),
    ]);
  const { state, grants } = rebuild({
    habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs, bodyLogs,
    journalLogs, gigs, bioReadings, settings, today,
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
  area?: Habit["area"];
  timeOfDay?: Habit["timeOfDay"];
  charge?: number;
  anchor?: string;
  reminderTime?: string;
  pings?: Habit["pings"];
  presetId?: string;
}): Promise<Habit> {
  const order = (await db.habits.count()) + 1;
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    icon: input.icon || "⚡",
    schedule: input.schedule,
    // "learning" area feeds the learning streak via domain.
    domain: input.domain ?? (input.area === "learning" ? "learning" : "general"),
    target: Math.max(1, input.target ?? 1),
    createdAt: Date.now(),
    order,
    ...(input.area ? { area: input.area } : {}),
    ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
    ...(input.charge ? { charge: Math.max(1, Math.min(5, input.charge)) } : {}),
    ...(input.anchor?.trim() ? { anchor: input.anchor.trim() } : {}),
    ...(input.reminderTime ? { reminderTime: input.reminderTime } : {}),
    ...(input.pings ? { pings: input.pings } : {}),
    ...(input.presetId ? { presetId: input.presetId } : {}),
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
  style?: WorkoutLog["style"];
  score?: string;
  durationMin?: number;
  distance?: number;
  note?: string;
  exercises?: WorkoutLog["exercises"];
}): Promise<WorkoutLog> {
  const entry: WorkoutLog = {
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    name: input.name.trim(),
    ...(input.style && input.style !== "sets" ? { style: input.style } : {}),
    ...(input.score?.trim() ? { score: input.score.trim() } : {}),
    ...(input.durationMin ? { durationMin: input.durationMin } : {}),
    ...(input.distance ? { distance: input.distance } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.exercises?.length ? { exercises: input.exercises } : {}),
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

export async function logWeight(weight: number, unit: "lbs" | "kg"): Promise<void> {
  if (!Number.isFinite(weight) || weight <= 0) return;
  await db.bodyLogs.add({
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    weight,
    unit,
  });
  await refreshPlayer();
}

export async function logJournal(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await db.journalLogs.add({
    id: crypto.randomUUID(), dayKey: await currentDayKey(), ts: Date.now(), text: trimmed,
  });
  await refreshPlayer();
}

/** Edit an entry's TEXT only — ts/dayKey are untouched, so the XP fold is
 *  unaffected (journal XP is per-day-first-entry, not text-derived). */
export async function updateJournal(id: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await db.journalLogs.update(id, { text: trimmed });
}

/** Deleting can remove a day's only journal entry → re-fold to keep XP honest. */
export async function deleteJournal(id: string): Promise<void> {
  await db.journalLogs.delete(id);
  await refreshPlayer();
}

export async function addGig(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await db.gigs.add({
    id: crypto.randomUUID(), text: trimmed, createdDay: await currentDayKey(), ts: Date.now(),
  });
}

export async function toggleGig(id: string, done: boolean): Promise<void> {
  if (done) {
    await db.gigs.update(id, { doneTs: Date.now(), doneDay: await currentDayKey() });
  } else {
    await db.gigs.update(id, { doneTs: undefined, doneDay: undefined });
  }
  await refreshPlayer();
}

export async function deleteGig(id: string): Promise<void> {
  await db.gigs.delete(id);
  await refreshPlayer();
}

export async function addBioMetric(input: {
  name: string;
  unit: string;
  pings?: { times: number; start: string; end: string };
}): Promise<void> {
  await db.bioMetrics.add({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    unit: input.unit.trim(),
    createdAt: Date.now(),
    ...(input.pings ? { pings: input.pings } : {}),
  });
}

export async function archiveBioMetric(id: string): Promise<void> {
  await db.bioMetrics.update(id, { archivedAt: Date.now() });
}

/** Turn a bio-metric's reminder on/off (clearing pings disables it). */
export async function setBioMetricPings(
  id: string,
  pings: { times: number; start: string; end: string } | undefined,
): Promise<void> {
  await db.bioMetrics.update(id, { pings });
}

export async function logBioReading(metricId: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;
  await db.bioReadings.add({
    id: crypto.randomUUID(), metricId, dayKey: await currentDayKey(), ts: Date.now(), value: trimmed,
  });
  await refreshPlayer();
}

/** No XP, no refreshPlayer toast path — screeners are never gamified. */
export async function logScreening(
  tool: "phq9" | "gad7",
  answers: number[],
): Promise<{ score: number }> {
  const score = answers.reduce((a, b) => a + b, 0);
  await db.screenings.add({
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    tool,
    score,
    answers,
  });
  return { score };
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
