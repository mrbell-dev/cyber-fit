import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { Goal } from "../../engine/index.ts";
import { addGoal, archiveGoal, updateGoal } from "../../db/repo.ts";
import { IconPicker } from "./IconPicker.tsx";

type SourceKind = Goal["source"]["kind"];

const HORIZONS: { id: Goal["horizon"]; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

const SOURCES: { id: SourceKind; label: string }[] = [
  { id: "habits", label: "Linked directives" },
  { id: "readingPages", label: "Reading pages" },
  { id: "workouts", label: "Workouts" },
];

/** Goal create/edit sheet — a goal is a lens over logs you already keep, so
 *  the only choices are what to count, how much, and by when. */
export function GoalEditor({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "🎯");
  const [horizon, setHorizon] = useState<Goal["horizon"]>(goal?.horizon ?? "week");
  const [target, setTarget] = useState(goal?.target ?? 4);
  const [sourceKind, setSourceKind] = useState<SourceKind>(goal?.source.kind ?? "habits");
  const [habitIds, setHabitIds] = useState<string[]>(
    goal?.source.kind === "habits" ? goal.source.habitIds : [],
  );

  const activeHabits = useLiveQuery(
    () => db.habits.filter((h) => !h.archivedAt).sortBy("order"),
    [],
  );

  const toggleHabit = (id: string) =>
    setHabitIds(habitIds.includes(id) ? habitIds.filter((x) => x !== id) : [...habitIds, id]);

  const save = async () => {
    if (!name.trim() || target < 1) return;
    const source: Goal["source"] =
      sourceKind === "habits" ? { kind: "habits", habitIds } : { kind: sourceKind };
    const fields = { name: name.trim(), icon: icon || "🎯", horizon, target, source };
    if (goal) await updateGoal(goal.id, fields);
    else await addGoal(fields);
    onClose();
  };

  const retire = async () => {
    if (!goal) return;
    await archiveGoal(goal.id);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal editor"
        role="dialog"
        aria-modal="true"
        aria-label={goal ? "Edit goal" : "New goal"}
        onClick={(e) => e.stopPropagation()}
      >
        <IconPicker icon={icon} onPick={setIcon} />

        <input
          className="input editor-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name the goal…"
          aria-label="Goal name"
          autoFocus={!goal}
        />

        <div className="editor-row">
          <span className="editor-row-label">Horizon</span>
          <select
            className="input anchor-input"
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as Goal["horizon"])}
            aria-label="Horizon"
          >
            {HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>

        <div className="editor-row">
          <span className="editor-row-label">Target</span>
          <input
            type="number"
            className="input num-input-sm"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Target"
          />
        </div>

        <div className="editor-row">
          <span className="editor-row-label">What counts</span>
          <select
            className="input anchor-input"
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value as SourceKind)}
            aria-label="What counts"
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {sourceKind === "habits" && (
            <>
              {(activeHabits ?? []).map((h) => (
                <label className="check-label" key={h.id}>
                  <input
                    type="checkbox"
                    checked={habitIds.includes(h.id)}
                    onChange={() => toggleHabit(h.id)}
                  />
                  {h.icon} {h.name}
                </label>
              ))}
              {habitIds.length === 0 && (
                <p className="placeholder">
                  // no directives linked yet — this goal won't move until you link at least one
                </p>
              )}
            </>
          )}
          {sourceKind === "readingPages" && (
            <p className="placeholder">// counts pages from reading sessions logged with a page count</p>
          )}
          {sourceKind === "workouts" && (
            <p className="placeholder">// counts every workout you log — any style</p>
          )}
        </div>

        {goal && (
          <div className="editor-row">
            <button className="link-btn" onClick={retire}>
              Retire goal — history stays
            </button>
          </div>
        )}

        <div className="install-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={!name.trim()}>
            {goal ? "Save changes" : "Set goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
