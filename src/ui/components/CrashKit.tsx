import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { BreathingOverlay } from "./Breathing.tsx";

// THE CRASH KIT — for the bad night. Rules stricter than anywhere else in the
// app: nothing here is logged, nothing earns XP, nothing is tracked, and every
// exercise works with zero signal. The only network action is the phone call
// the user chooses to make.

const GROUNDING_STEPS: { count: number; sense: string; hint: string }[] = [
  { count: 5, sense: "things you can SEE", hint: "Name them out loud or in your head. The mug. The doorframe. Slow is fine." },
  { count: 4, sense: "things you can FEEL", hint: "Your feet on the floor. The chair. Fabric. Temperature." },
  { count: 3, sense: "things you can HEAR", hint: "The hum of something. Traffic. Your own breathing." },
  { count: 2, sense: "things you can SMELL", hint: "Or two smells you like, if the room is quiet on smells." },
  { count: 1, sense: "thing you can TASTE", hint: "Or take one slow sip of water. That counts." },
];

function Grounding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const done = step >= GROUNDING_STEPS.length;
  const s = GROUNDING_STEPS[Math.min(step, GROUNDING_STEPS.length - 1)];

  return (
    <div className="overlay">
      <div className="modal boot-modal" role="dialog" aria-modal="true" aria-label="Grounding exercise">
        {done ? (
          <>
            <p className="boot-greeting">Back in the Room.</p>
            <p className="boot-sub">
              That's the whole exercise. Your senses are anchors — they only work in the
              present, which is where you are now.
            </p>
            <button className="btn" onClick={onClose}>
              Okay
            </button>
          </>
        ) : (
          <>
            <p className="boot-greeting">
              {s.count} {s.sense}
            </p>
            <p className="boot-sub">{s.hint}</p>
            <button className="btn" onClick={() => setStep(step + 1)}>
              {step === GROUNDING_STEPS.length - 1 ? "Done" : "Got them — next"}
            </button>
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoodFrames({ onClose }: { onClose: () => void }) {
  const highlights = useLiveQuery(async () => {
    const all = await db.highlightLogs.toArray();
    return all.sort((a, b) => b.ts - a.ts).slice(0, 10);
  }, []);

  return (
    <div className="overlay">
      <div className="modal editor" role="dialog" aria-modal="true" aria-label="Your good frames">
        <h2 className="card-title">The Good Frames Are Real</h2>
        {highlights && highlights.length > 0 ? (
          <>
            <p className="boot-sub">
              You logged every one of these yourself, on days that actually happened. A bad
              night can't unhappen them.
            </p>
            {highlights.map((h) => (
              <p className="highlight-text reel" key={h.id}>
                <span className="off-day-tag">{h.dayKey}</span> ◆ {h.text}
              </p>
            ))}
          </>
        ) : (
          <p className="boot-sub">
            No highlights logged yet — which just means the reel starts tomorrow. Tonight,
            getting through is the win.
          </p>
        )}
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function CrashKit({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"menu" | "breathe" | "ground" | "frames">("menu");

  if (mode === "breathe") return <BreathingOverlay onClose={() => setMode("menu")} />;
  if (mode === "ground") return <Grounding onClose={() => setMode("menu")} />;
  if (mode === "frames") return <GoodFrames onClose={() => setMode("menu")} />;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal boot-modal crash-kit"
        role="dialog"
        aria-modal="true"
        aria-label="Crash kit"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="boot-greeting">You're Here. Right Move.</p>
        <p className="boot-sub">
          Rough moment on the grid. Pick whatever helps — there's no wrong door.
        </p>
        <button className="btn crash-option" onClick={() => setMode("breathe")}>
          🫁 Breathe with me — 2 min
        </button>
        <button className="btn crash-option" onClick={() => setMode("ground")}>
          🌊 Ground yourself — 5·4·3·2·1
        </button>
        <button className="btn crash-option" onClick={() => setMode("frames")}>
          ◆ The good frames are real
        </button>
        <a className="btn crash-option crash-call" href="tel:988">
          📞 Call 988 — Suicide &amp; Crisis Lifeline (US)
        </a>
        <a className="btn crash-option crash-call" href="sms:988">
          💬 Text 988 instead
        </a>
        <p className="boot-sub">
          Outside the US: findahelpline.com has your local line.
          <br />
          Nothing in this kit is logged, scored, or tracked. It all works with zero signal.
        </p>
        <button className="btn ghost" onClick={onClose}>
          Back to the grid
        </button>
      </div>
    </div>
  );
}
