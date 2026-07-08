import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { coastDay, type DayKey, type Goal, type GoalTables } from "../../engine/index.ts";

const PERIOD_NOUN: Record<Goal["horizon"], string> = {
  week: "the week",
  month: "the month",
  year: "the year",
};

/** Did anything land today that already moves this goal? If so, stay quiet. */
function movedToday(goal: Goal, tables: GoalTables, today: DayKey): boolean {
  if (goal.source.kind === "habits") {
    const ids = new Set(goal.source.habitIds);
    return tables.habitLogs.some(
      (l) => l.dayKey === today && l.kind === "done" && l.amount > 0 && ids.has(l.habitId),
    );
  }
  if (goal.source.kind === "readingPages") {
    return tables.readingLogs.some((l) => l.dayKey === today && (l.pages ?? 0) > 0);
  }
  return tables.workoutLogs.some((l) => l.dayKey === today);
}

/** Coast-day nudge: a goal is behind pace but nothing is even scheduled today —
 *  one optional rep would help. An invitation, never a deficit. Doctrine: no
 *  counts of anything missed, ever. */
export function GoalBanner({ today }: { today: DayKey }) {
  const data = useLiveQuery(async () => {
    const [goals, habits, habitLogs, readingLogs, workoutLogs] = await Promise.all([
      db.goals.filter((g) => !g.archivedAt).sortBy("order"),
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.readingLogs.toArray(),
      db.workoutLogs.toArray(),
    ]);
    return { goals, habits, tables: { habitLogs, readingLogs, workoutLogs } };
  }, []);

  if (!data) return null;

  const goal = data.goals.find(
    (g) => coastDay(g, data.habits, data.tables, today) && !movedToday(g, data.tables, today),
  );
  if (!goal) return null;

  return (
    <div className="missed-ping goal-banner" role="status">
      <span>
        <span className="missed-ping-title">▸ PACE</span>
        {" — "}
        {goal.name}: one today puts {PERIOD_NOUN[goal.horizon]} back on pace.
      </span>
    </div>
  );
}
