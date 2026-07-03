import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  DEFAULT_REMINDERS,
  duePingsToday,
  REMINDER_COPY,
  type DayKey,
  type Reminders,
} from "../../engine/index.ts";

/**
 * Offline-first reminder fallback: on open, if pings were due earlier today
 * and nothing has been logged since the last one, nudge — gently, once.
 */
export function MissedPing({ today }: { today: DayKey }) {
  const info = useLiveQuery(async () => {
    const [remRow, habits, habitLogs, waterLogs, moodLogs] = await Promise.all([
      db.kv.get("reminders"),
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.habitLogs.where({ dayKey: today }).toArray(),
      db.waterLogs.where({ dayKey: today }).toArray(),
      db.moodLogs.where({ dayKey: today }).toArray(),
    ]);
    const reminders = { ...DEFAULT_REMINDERS, ...((remRow?.value as Partial<Reminders>) ?? {}) };
    const lastLogTs = Math.max(
      0,
      ...habitLogs.map((l) => l.ts),
      ...waterLogs.map((l) => l.ts),
      ...moodLogs.map((l) => l.ts),
    );
    return { reminders, habits, lastLogTs };
  }, [today]);

  if (!info) return null;

  const now = new Date();
  const due = duePingsToday(
    info.reminders,
    now.getDay(),
    now.getHours() * 60 + now.getMinutes(),
    info.habits,
  );
  if (due.length === 0) return null;

  const latest = due.reduce((a, b) => (a.minutes > b.minutes ? a : b));
  const latestTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, latest.minutes).getTime();
  if (info.lastLogTs >= latestTs) return null;

  const missed = due.filter((p) => {
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, p.minutes).getTime();
    return ts > info.lastLogTs;
  });

  return (
    <div className="missed-ping" role="status">
      <span className="missed-ping-title">⚠ MISSED PING ×{missed.length}</span>
      <span>
        {latest.kind === "habit" && latest.label
          ? `Directive window open: ${latest.label}`
          : REMINDER_COPY[latest.kind]}
      </span>
    </div>
  );
}
