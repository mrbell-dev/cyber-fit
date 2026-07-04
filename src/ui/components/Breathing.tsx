import { useEffect, useRef, useState } from "react";
import { haptics } from "../haptics.ts";

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;
const PHASE_S = 4; // box breathing 4-4-4-4
const ROUNDS = 8; // ~2 minutes

/** Guided box breathing. Animated square honors prefers-reduced-motion (the
 *  phase text + count always carry the exercise on their own). Shared by the
 *  habit menu and (soon) the Crash Kit. */
export function BreathingOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(PHASE_S);
  const [round, setRound] = useState(1);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => {
        if (c > 1) return c - 1;
        setPhase((p) => {
          const next = (p + 1) % 4;
          if (next === 0) {
            setRound((r) => {
              if (r >= ROUNDS && !done.current) {
                done.current = true;
                haptics.tap();
              }
              return Math.min(r + 1, ROUNDS);
            });
          }
          return next;
        });
        return PHASE_S;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const finished = done.current && round >= ROUNDS;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal boot-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Guided breathing"
        onClick={(e) => e.stopPropagation()}
      >
        {finished ? (
          <>
            <p className="boot-greeting">Systems Steadied.</p>
            <p className="boot-sub">// eight rounds. wetware recalibrated.</p>
            <button className="btn" onClick={onClose}>
              Back to the grid
            </button>
          </>
        ) : (
          <>
            <div className={`breath-box phase-${phase}`} aria-hidden="true" />
            <p className="boot-greeting" aria-live="assertive">
              {PHASES[phase]}
            </p>
            <p className="boot-sub">
              {count} · round {round}/{ROUNDS}
            </p>
            <button className="btn ghost" onClick={onClose}>
              Enough for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
