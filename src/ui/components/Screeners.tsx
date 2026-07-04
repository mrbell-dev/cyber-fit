import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  needsCrisisResources,
  SCREENER_OPTIONS,
  SCREENERS,
  scoreBand,
  type ScreenerDef,
} from "../../engine/index.ts";
import { logScreening } from "../../db/repo.ts";

function Runner({ def, onClose }: { def: ScreenerDef; onClose: () => void }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number } | null>(null);
  const i = answers.length;

  const answer = async (v: number) => {
    const next = [...answers, v];
    setAnswers(next);
    if (next.length === def.items.length) {
      setResult(await logScreening(def.tool, next));
    }
  };

  return (
    <div className="overlay">
      <div className="modal editor" role="dialog" aria-modal="true" aria-label={def.name}>
        {result ? (
          <>
            <h2 className="card-title">{def.name}</h2>
            <p>
              Score: <strong>{result.score} / {def.maxScore}</strong> — {scoreBand(def, result.score)} range
            </p>
            {needsCrisisResources(def.tool, answers) && (
              <p className="crisis-note">
                One of your answers matters more than any score. If you're in the US, the 988
                Suicide &amp; Crisis Lifeline is there right now — <a href="tel:988">call</a> or{" "}
                <a href="sms:988">text 988</a>. Telling your therapist about this answer is a
                strong move, not a weak one.
              </p>
            )}
            <p className="placeholder">
              // this is a screener, not a diagnosis. its real value is the trend over time —
              which you can share via the Trauma Team export in STATS
            </p>
            <button className="btn" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="card-title">{def.name} — {i + 1}/{def.items.length}</h2>
            <p className="placeholder">// {def.prompt}</p>
            <p className="screener-item">{def.items[i]}</p>
            <div className="screener-options">
              {SCREENER_OPTIONS.map((label, v) => (
                <button key={v} className="btn ghost screener-opt" onClick={() => answer(v)}>
                  {label}
                </button>
              ))}
            </div>
            <button className="link-btn" onClick={onClose}>
              stop — nothing is saved until the last question
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Optional self-screeners. No XP, no streaks, no crits — deliberately outside
 *  the game layer so answers stay honest. Trends feed the Trauma Team export. */
export function ScreenerCard() {
  const [active, setActive] = useState<ScreenerDef | null>(null);
  const history = useLiveQuery(async () => {
    const all = await db.screenings.toArray();
    return all.sort((a, b) => b.ts - a.ts);
  }, []);

  return (
    <div className="card">
      <h2 className="card-title">Self-Screeners (Optional)</h2>
      <p className="placeholder">
        // standard clinical screeners (PHQ-9 / GAD-7), on your schedule. no XP, no
        streaks — this sits outside the game on purpose, so answers stay honest.
        trends land in the Trauma Team export for your care team
      </p>
      <div className="form-row">
        {SCREENERS.map((def) => {
          const last = (history ?? []).find((h) => h.tool === def.tool);
          return (
            <button key={def.tool} className="btn ghost" onClick={() => setActive(def)}>
              {def.tool === "phq9" ? "PHQ-9" : "GAD-7"}
              {last ? ` · last ${last.score}` : ""}
            </button>
          );
        })}
      </div>
      {(history ?? []).slice(0, 4).map((h) => {
        const def = SCREENERS.find((d) => d.tool === h.tool)!;
        return (
          <div className="row-item" key={h.id}>
            <span className="off-day-tag">
              {h.dayKey} · {h.tool === "phq9" ? "PHQ-9" : "GAD-7"} {h.score}/{def.maxScore} ·{" "}
              {scoreBand(def, h.score)}
            </span>
          </div>
        );
      })}
      {active && <Runner def={active} onClose={() => setActive(null)} />}
    </div>
  );
}
