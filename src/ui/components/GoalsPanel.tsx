import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { goalProgress, lastPeriodResult, type DayKey, type Goal } from "../../engine/index.ts";
import { logGoalProgress, undoLastGoalProgress } from "../../db/repo.ts";
import { GoalEditor } from "./GoalEditor.tsx";

const PERIOD_LABEL: Record<Goal["horizon"], string> = {
  week: "week",
  month: "month",
  year: "year",
  lifelong: "all-time",
};

const PACE_LABEL = { ahead: "ahead", on: "on pace", behind: "behind", none: "" } as const;

/** Goals as a lens over the logs — progress, pace, days left. Manual goals add
 *  a ＋ to log progress by hand; open-ended goals (no target) show a running
 *  count with no bar; lifelong goals never reset. */
export function GoalsPanel({ today }: { today: DayKey }) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  const data = useLiveQuery(async () => {
    const [goals, habitLogs, readingLogs, workoutLogs, goalLogs] = await Promise.all([
      db.goals.filter((g) => !g.archivedAt).sortBy("order"),
      db.habitLogs.toArray(),
      db.readingLogs.toArray(),
      db.workoutLogs.toArray(),
      db.goalLogs.toArray(),
    ]);
    return { goals, tables: { habitLogs, readingLogs, workoutLogs, goalLogs } };
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
          // track anything over a week, month, year, or lifelong — from what you
          already log, or a manual tally you tap. a target is optional
        </p>
      ) : (
        data.goals.map((g) => {
          const p = goalProgress(g, data.tables, today);
          const manual = g.source.kind === "manual";
          const pct = p.target ? Math.min(100, (p.value / p.target) * 100) : 0;
          const done = p.target ? p.value >= p.target : false;
          const last = lastPeriodResult(g, data.tables, today);

          const chip = done
            ? "✔ done"
            : p.openEnded
              ? `${p.value}`
              : p.pace === "none"
                ? `${p.value}/${p.target}`
                : PACE_LABEL[p.pace];

          // concrete next step for a targeted, timed goal — "~2/day hits it"
          const remaining = p.target ? Math.max(0, p.target - p.value) : 0;
          const hint = done || p.openEnded || p.lifelong
            ? null
            : p.daysLeft > 0
              ? `≈${Math.ceil(remaining / (p.daysLeft + 1))}/day hits it`
              : `${remaining} more today hits it`;

          const meta = p.lifelong
            ? p.openEnded ? `${p.value} logged` : `${p.value}/${p.target} · all-time`
            : p.openEnded
              ? `${p.value} this ${PERIOD_LABEL[g.horizon]} · ${p.daysLeft}d left`
              : `${p.value}/${p.target} · ${PERIOD_LABEL[g.horizon]} · ${p.daysLeft}d left${hint ? ` · ${hint}` : ""}`;

          return (
            <div className="goal-row" key={g.id}>
              <button className="goal-row-main" onClick={() => setEditing(g)} aria-label={`Edit goal ${g.name}`}>
                <div className="goal-row-top">
                  <span className="goal-name">
                    {g.icon ? `${g.icon} ` : ""}
                    {g.name}
                  </span>
                  <span className={done ? "goal-chip done" : `goal-chip ${p.pace}`}>{chip}</span>
                </div>
                {!p.openEnded && (
                  <div className="goal-bar" aria-hidden="true">
                    <div className="goal-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <span className="goal-meta">{meta}</span>
                {last && last.value > 0 && (
                  <span className="goal-meta goal-last">
                    last {PERIOD_LABEL[g.horizon]}: {last.value}{last.target ? `/${last.target}` : ""}
                  </span>
                )}
              </button>
              {manual && (
                <div className="goal-manual" role="group" aria-label={`Log progress for ${g.name}`}>
                  <button className="goal-log-btn" aria-label={`Add one to ${g.name}`}
                    onClick={() => logGoalProgress(g.id, 1)}>
                    ＋1
                  </button>
                  {p.value > 0 && (
                    <button className="goal-undo-btn" aria-label={`Undo last for ${g.name}`}
                      onClick={() => undoLastGoalProgress(g.id)}>
                      ↩
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
