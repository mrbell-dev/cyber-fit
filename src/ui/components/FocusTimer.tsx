import { useEffect, useState } from "react";
import type { Habit } from "../../engine/index.ts";
import { logHabit } from "../../db/repo.ts";
import { haptics } from "../haptics.ts";

const CHOICES = [10, 15, 25];

/** Focus timer attached to a directive (pomodoro-ish, body-doubling adjacent).
 *  Finishing the session logs the directive automatically. */
export function FocusTimer({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (minutes === null || finished) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(id);
        setFinished(true);
        haptics.levelUp();
        logHabit(habit.id);
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [minutes, finished, habit.id]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="overlay" onClick={minutes === null ? onClose : undefined}>
      <div
        className="modal boot-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Focus timer for ${habit.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        {minutes === null ? (
          <>
            <p className="boot-greeting">Focus Protocol</p>
            <p className="boot-sub">
              {habit.icon} {habit.name} — pick a window. Finishing logs it automatically.
            </p>
            <div className="chip-row">
              {CHOICES.map((m) => (
                <button
                  key={m}
                  className="chip"
                  onClick={() => {
                    setMinutes(m);
                    setLeft(m * 60);
                  }}
                >
                  {m} min
                </button>
              ))}
            </div>
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : finished ? (
          <>
            <p className="boot-greeting">Session Complete.</p>
            <p className="boot-sub">// directive logged. preem work.</p>
            <button className="btn" onClick={onClose}>
              Back to the grid
            </button>
          </>
        ) : (
          <>
            <p className="boot-greeting timer-display">
              {mm}:{ss}
            </p>
            <p className="boot-sub">
              {habit.icon} {habit.name} — stay with it, choom
            </p>
            <button className="btn ghost" onClick={onClose}>
              Abort (no log)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
