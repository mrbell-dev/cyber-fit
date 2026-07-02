// The ONLY write path to the database. UI components call these; nothing else
// writes. Reads happen via dexie-react-hooks useLiveQuery against `db` directly.
import {
  DEFAULT_SETTINGS,
  dayKeyFor,
  type DayKey,
  type Habit,
  type HabitLog,
  type Schedule,
  type Settings,
  type WaterLog,
} from "../engine/index.ts";
import { db } from "./db.ts";

const SETTINGS_KEY = "settings";

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
  return entry;
}
