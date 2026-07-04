import { useState } from "react";
import { BreathingOverlay } from "./Breathing.tsx";
import { FocusTimer } from "./FocusTimer.tsx";
import type { DayKey, DayStatus, Habit } from "../../engine/index.ts";
import { addDays } from "../../engine/index.ts";
import { logHabit, undoHabit } from "../../db/repo.ts";

export function HabitCard({
  habit,
  status,
  streak,
  today,
  scheduledToday,
}: {
  habit: Habit;
  status: DayStatus;
  streak: number;
  today: DayKey;
  scheduledToday: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [timer, setTimer] = useState(false);

  const tap = async () => {
    if (status.done && habit.target === 1) await undoHabit(habit.id);
    else await logHabit(habit.id);
  };

  const cls = [
    "habit-card",
    status.done ? "done" : "",
    status.skipped ? "skipped" : "",
    !scheduledToday ? "off-day" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <button className="habit-main" onClick={tap} aria-pressed={status.done}>
        <span className="habit-icon" aria-hidden="true">
          {habit.icon}
        </span>
        <span className="habit-name">
          {habit.name}
          {habit.anchor && <span className="off-day-tag anchor-tag"> · after {habit.anchor.replace(/^after /i, "")}</span>}
          {!scheduledToday && <span className="off-day-tag"> · off-day</span>}
          {status.skipped && <span className="off-day-tag"> · rest</span>}
        </span>
        <span className="habit-right">
          {streak > 0 && <span className="streak-chip">⚡{streak}</span>}
          {habit.target > 1 ? (
            <span className="habit-count">
              {status.count}/{habit.target}
            </span>
          ) : (
            <span className={status.done ? "checkbox on" : "checkbox"} aria-hidden="true">
              {status.done ? "✓" : ""}
            </span>
          )}
        </span>
      </button>

      <button className="habit-menu-btn" aria-label={`${habit.name} options`} onClick={() => setMenu(!menu)}>
        ⋯
      </button>

      {menu && (
        <div className="habit-menu">
          <button
            onClick={async () => {
              await logHabit(habit.id, { dayKey: addDays(today, -1) });
              setMenu(false);
            }}
          >
            Log for yesterday
          </button>
          <button
            onClick={async () => {
              await logHabit(habit.id, { kind: "skip" });
              setMenu(false);
            }}
          >
            Rest today (keeps streak)
          </button>
          <button
            onClick={() => {
              setTimer(true);
              setMenu(false);
            }}
          >
            Focus timer (logs on finish)
          </button>
          <button
            onClick={() => {
              setBreathing(true);
              setMenu(false);
            }}
          >
            Breathe first — 2 min
          </button>
          {status.count > 0 && (
            <button
              onClick={async () => {
                await undoHabit(habit.id);
                setMenu(false);
              }}
            >
              Undo one
            </button>
          )}
          <button onClick={() => setMenu(false)}>Close</button>
        </div>
      )}
      {breathing && <BreathingOverlay onClose={() => setBreathing(false)} />}
      {timer && <FocusTimer habit={habit} onClose={() => setTimer(false)} />}
    </div>
  );
}
