// The ONLY write path to the database. UI components call these; nothing else
// writes. Reads happen via dexie-react-hooks useLiveQuery against `db` directly.
import {
  DEFAULT_SETTINGS,
  dayKeyFor,
  rebuild,
  type DayKey,
  type Goal,
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
  med?: Habit["med"];
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
    ...(input.med ? { med: input.med } : {}),
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

/** Every real deletion leaves a tombstone so merge-import (vault sync) never
 *  resurrects the row from an older snapshot. */
async function tombstone(table: string, ...ids: string[]): Promise<void> {
  const ts = Date.now();
  await db.tombstones.bulkPut(ids.map((id) => ({ id, table, ts })));
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction("rw", db.habits, db.habitLogs, db.tombstones, async () => {
    const logIds = (await db.habitLogs.where({ habitId: id }).primaryKeys()) as string[];
    await db.habitLogs.where({ habitId: id }).delete();
    await db.habits.delete(id);
    await tombstone("habitLogs", ...logIds);
    await tombstone("habits", id);
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
  pages?: number;
  note?: string;
  feeling?: ReadingLog["feeling"];
}): Promise<ReadingLog> {
  const entry: ReadingLog = {
    id: crypto.randomUUID(),
    dayKey: await currentDayKey(),
    ts: Date.now(),
    ...(input.itemId ? { itemId: input.itemId } : {}),
    ...(input.minutes ? { minutes: input.minutes } : {}),
    ...(input.pages ? { pages: input.pages } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.feeling ? { feeling: input.feeling } : {}),
  };
  await db.readingLogs.add(entry);
  await refreshPlayer();
  return entry;
}

// ---------- goals ----------

export async function addGoal(
  input: Omit<Goal, "id" | "createdAt" | "order">,
): Promise<Goal> {
  const order = (await db.goals.count()) + 1;
  const goal: Goal = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    order,
  };
  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, "id">>): Promise<void> {
  await db.goals.update(id, patch);
}

export async function archiveGoal(id: string): Promise<void> {
  await db.goals.update(id, { archivedAt: Date.now() });
}

/** Add manual progress to a goal (amount may be negative to undo). Goals earn
 *  no XP — they're a lens, not a game mechanic — so no refreshPlayer. */
export async function logGoalProgress(goalId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) return;
  await db.goalLogs.add({
    id: crypto.randomUUID(),
    goalId,
    dayKey: await currentDayKey(),
    ts: Date.now(),
    amount,
  });
}

/** Undo the most recent manual increment for a goal. */
export async function undoLastGoalProgress(goalId: string): Promise<void> {
  const logs = await db.goalLogs.where({ goalId }).toArray();
  const last = logs.sort((a, b) => b.ts - a.ts)[0];
  if (last) await db.goalLogs.delete(last.id);
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
  await tombstone("journalLogs", id);
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
  await tombstone("gigs", id);
  await refreshPlayer();
}

/** Retire a gig via the daily migration — drops it off the board but keeps the
 *  row (no-delete doctrine). Retiring earns/loses no XP, so no re-fold needed. */
export async function retireGig(id: string): Promise<void> {
  await db.gigs.update(id, { retiredDay: await currentDayKey() });
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

/** Undo the most recent reading of a metric — for the inevitable mistype. */
export async function undoLastBioReading(metricId: string): Promise<void> {
  const mine = await db.bioReadings.where({ metricId }).toArray();
  const last = mine.sort((a, b) => b.ts - a.ts)[0];
  if (!last) return;
  await db.bioReadings.delete(last.id);
  await tombstone("bioReadings", last.id);
  await refreshPlayer();
}

/** Undo the most recent weigh-in (bodyLogs) — same mistype safety net. */
export async function undoLastWeight(): Promise<void> {
  const all = await db.bodyLogs.toArray();
  const last = all.sort((a, b) => b.ts - a.ts)[0];
  if (!last) return;
  await db.bodyLogs.delete(last.id);
  await tombstone("bodyLogs", last.id);
  await refreshPlayer();
}

/** Undo the most recent mood reading — same mistype safety net. */
export async function undoLastMood(): Promise<void> {
  const all = await db.moodLogs.toArray();
  const last = all.sort((a, b) => b.ts - a.ts)[0];
  if (!last) return;
  await db.moodLogs.delete(last.id);
  await tombstone("moodLogs", last.id);
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

// ---------- layout persistence ----------

import { defaultLayout, type LayoutConfig } from "../ui/layout";

/** Single write path for the layout row. Nothing else writes kv key "layout". */
export async function setLayout(cfg: LayoutConfig): Promise<void> {
  await db.kv.put({ key: "layout", value: cfg });
}

export async function getLayout(): Promise<LayoutConfig> {
  const row = await db.kv.get("layout");
  return ((row?.value as LayoutConfig | undefined) ?? defaultLayout());
}

// ---------- recurring gig templates ----------

import { templatesDue } from "../engine/index.ts";

export async function addGigTemplate(text: string, days: number[]): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || days.length === 0) return;
  await db.gigTemplates.add({
    id: crypto.randomUUID(),
    text: trimmed,
    days: [...days].sort((a, b) => a - b),
    ts: Date.now(),
  });
}

/** Stop future spawns; the template row stays (no-delete doctrine). */
export async function retireGigTemplate(id: string): Promise<void> {
  await db.gigTemplates.update(id, { retiredTs: Date.now() });
}

/** Materialize today's recurring gigs. Idempotent — safe on every board
 *  mount; the engine's templatesDue skips anything already represented. */
export async function spawnGigsFromTemplates(today: DayKey): Promise<void> {
  const [templates, gigs] = await Promise.all([
    db.gigTemplates.toArray(),
    db.gigs.toArray(),
  ]);
  for (const t of templatesDue(templates, gigs, today)) {
    await db.gigs.add({
      id: crypto.randomUUID(),
      text: t.text,
      createdDay: today,
      ts: Date.now(),
      templateId: t.id,
    });
  }
}
