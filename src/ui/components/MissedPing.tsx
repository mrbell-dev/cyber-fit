import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  DEFAULT_REMINDERS,
  dayStatus,
  duePingsToday,
  medWindow,
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
    const [remRow, habits, habitLogs, waterLogs, moodLogs, recentLogs] = await Promise.all([
      db.kv.get("reminders"),
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.habitLogs.where({ dayKey: today }).toArray(),
      db.waterLogs.where({ dayKey: today }).toArray(),
      db.moodLogs.where({ dayKey: today }).toArray(),
      db.habitLogs.filter((l) => l.ts >= Date.now() - 2 * 86_400_000).toArray(),
    ]);
    const reminders = { ...DEFAULT_REMINDERS, ...((remRow?.value as Partial<Reminders>) ?? {}) };
    const lastLogTs = Math.max(
      0,
      ...habitLogs.map((l) => l.ts),
      ...waterLogs.map((l) => l.ts),
      ...moodLogs.map((l) => l.ts),
    );
    return { reminders, habits, habitLogs, recentLogs, lastLogTs };
  }, [today]);

  if (!info) return null;

  const now = new Date();
  // Which habits are already satisfied today (quiets untilDone pings).
  const doneHabits = new Set(
    info.habits
      .filter((h) => dayStatus(h, info.habitLogs.filter((l) => l.habitId === h.id)).done)
      .map((h) => h.id),
  );
  // Meds go quiet once their window is taken or closed — the card carries
  // that state, the banner never nags about it.
  const quietMedHabits = new Set(
    info.habits
      .filter((h) => h.med)
      .filter((h) => {
        const w = medWindow(h, Date.now(), now.getTimezoneOffset(), info.recentLogs);
        return w?.state === "taken" || w?.state === "closed";
      })
      .map((h) => h.id),
  );
  const due = duePingsToday(
    info.reminders,
    now.getDay(),
    now.getHours() * 60 + now.getMinutes(),
    info.habits,
  ).filter((p) => {
    if (p.kind === "motivation") return false; // encouragement never "misses"
    if (p.habitId && quietMedHabits.has(p.habitId)) return false;
    if (p.untilDone && p.habitId && doneHabits.has(p.habitId)) return false;
    return true;
  });
  if (due.length === 0) return null;

  const latest = due.reduce((a, b) => (a.minutes > b.minutes ? a : b));
  const latestTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, latest.minutes).getTime();
  if (info.lastLogTs >= latestTs) return null;

  // Doctrine: never show a count. One gentle line, the most recent thing due.
  return (
    <div className="missed-ping" role="status">
      <span className="missed-ping-title">▸ PING WAITING</span>
      <span>
        {latest.kind === "habit" && latest.label
          ? `Directive window open: ${latest.label}`
          : REMINDER_COPY[latest.kind]}
      </span>
    </div>
  );
}
