import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { goalProgress, type DayKey, type Goal } from "../../engine/index.ts";
import { GoalEditor } from "./GoalEditor.tsx";

const PERIOD_LABEL: Record<Goal["horizon"], string> = {
  week: "week",
  month: "month",
  year: "year",
};

const PACE_LABEL = { ahead: "ahead", on: "on pace", behind: "behind" } as const;

/** Goals as a read-only lens over the logs — progress, pace, days left.
 *  Pace is text, never color alone; hitting the target flips to "✔ done". */
export function GoalsPanel({ today }: { today: DayKey }) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  const data = useLiveQuery(async () => {
    const [goals, habitLogs, readingLogs, workoutLogs] = await Promise.all([
      db.goals.filter((g) => !g.archivedAt).sortBy("order"),
      db.habitLogs.toArray(),
      db.readingLogs.toArray(),
      db.workoutLogs.toArray(),
    ]);
    return { goals, tables: { habitLogs, readingLogs, workoutLogs } };
  }, []);

  if (!data) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Goals</h2>
        <button className="card-add" aria-label="New goal" onClick={() => setEditing("new")}>
          +
        </button>
      </div>
      {editing && (
        <GoalEditor goal={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {data.goals.length === 0 ? (
        <p className="placeholder">
          // set a target over a week, month, or year — it counts what you already log, no extra taps
        </p>
      ) : (
        data.goals.map((g) => {
          const p = goalProgress(g, data.tables, today);
          const pct = Math.min(100, p.target > 0 ? (p.value / p.target) * 100 : 0);
          const done = p.value >= p.target;
          return (
            <button
              key={g.id}
              className="goal-row"
              onClick={() => setEditing(g)}
              aria-label={`Edit goal ${g.name}`}
            >
              <div className="goal-row-top">
                <span className="goal-name">
                  {g.icon ? `${g.icon} ` : ""}
                  {g.name}
                </span>
                <span className={done ? "goal-chip done" : `goal-chip ${p.pace}`}>
                  {done ? "✔ done" : PACE_LABEL[p.pace]}
                </span>
              </div>
              <div className="goal-bar" aria-hidden="true">
                <div className="goal-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="goal-meta">
                {p.value}/{p.target} · {PERIOD_LABEL[g.horizon]} · {p.daysLeft}d left
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
