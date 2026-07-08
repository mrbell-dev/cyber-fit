import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BreathingOverlay } from "./Breathing.tsx";
import { FocusTimer } from "./FocusTimer.tsx";
import type { DayKey, DayStatus, Habit } from "../../engine/index.ts";
import { addDays, medWindow } from "../../engine/index.ts";
import { db } from "../../db/db.ts";
import { logHabit, undoHabit } from "../../db/repo.ts";

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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

  const recentLogs = useLiveQuery(
    () =>
      db.habitLogs
        .where({ habitId: habit.id })
        .filter((l) => l.ts >= Date.now() - 2 * 86_400_000)
        .toArray(),
    [habit.id],
  );

  const med = habit.med
    ? medWindow(habit, Date.now(), new Date().getTimezoneOffset(), recentLogs ?? [])
    : null;

  // A dose logged under a past anchorDayKey (cross-midnight window) is
  // invisible to today's dayKey bucketing, so for med cards the window
  // state — not status.done — is the truth for done/undo.
  const medTaken = med?.state === "taken";
  const showDone = status.done || medTaken;

  const tap = async () => {
    if (medTaken) {
      return void (await undoHabit(habit.id, med.anchorDayKey !== today ? med.anchorDayKey : undefined));
    }
    if (status.done && habit.target === 1) return void (await undoHabit(habit.id));
    if (med && (med.state === "open" || med.state === "closed") && med.anchorDayKey !== today) {
      return void (await logHabit(habit.id, { dayKey: med.anchorDayKey }));
    }
    await logHabit(habit.id);
  };

  const cls = [
    "habit-card",
    showDone ? "done" : "",
    status.skipped ? "skipped" : "",
    !scheduledToday ? "off-day" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <button className="habit-main" onClick={tap} aria-pressed={showDone}>
        <span className="habit-icon" aria-hidden="true">
          {habit.icon}
        </span>
        <span className="habit-name">
          {habit.name}
          {med && med.state === "closed" && !status.done ? (
            <span className="off-day-tag med-closed">
              {" "}
              Window closed — skip today's dose. Fresh start tomorrow.
            </span>
          ) : (
            <>
              {habit.anchor && (
                <span className="off-day-tag anchor-tag"> · after {habit.anchor.replace(/^after /i, "")}</span>
              )}
              {!scheduledToday && <span className="off-day-tag"> · off-day</span>}
              {status.skipped && <span className="off-day-tag"> · rest</span>}
              {med && med.state === "upcoming" && <span className="off-day-tag"> · due {formatTime(med.opensAt)}</span>}
              {med && med.state === "open" && (
                <span className="off-day-tag"> · window closes {formatTime(med.closesAt)}</span>
              )}
              {medTaken && !status.done && <span className="off-day-tag"> · taken</span>}
            </>
          )}
        </span>
        <span className="habit-right">
          {streak > 0 && <span className="streak-chip">⚡{streak}</span>}
          {habit.target > 1 ? (
            <span className="habit-count">
              {status.count}/{habit.target}
            </span>
          ) : (
            <span className={showDone ? "checkbox on" : "checkbox"} aria-hidden="true">
              {showDone ? "✓" : ""}
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
