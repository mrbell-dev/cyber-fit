import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { cadenceLabel, GIG_DOW_LABELS, type DayKey } from "../../engine/index.ts";
import {
  addGig,
  addGigTemplate,
  deleteGig,
  retireGigTemplate,
  spawnGigsFromTemplates,
  toggleGig,
} from "../../db/repo.ts";

const ALL_DOW = [0, 1, 2, 3, 4, 5, 6];

/** Bullet-journal gigs: today's jobs. Unfinished gigs from previous days
 *  simply stay on the board (that's the rollover) — no shame markers, they're
 *  just still open. Tasks, not habits: no streaks attached. Recurring gigs
 *  spawn fresh rows from templates on their scheduled weekdays. */
export function GigList({ today }: { today: DayKey }) {
  const [text, setText] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>(ALL_DOW);

  // Materialize today's recurring gigs on mount / day rollover. Idempotent —
  // the engine's templatesDue skips anything already on the board.
  useEffect(() => {
    void spawnGigsFromTemplates(today);
  }, [today]);

  const gigs = useLiveQuery(async () => {
    const all = await db.gigs.toArray();
    // Board = open gigs (not retired) from any day + gigs completed today;
    // older completions and migrated-away gigs drop off.
    return all
      .filter((g) => !g.retiredDay && (!g.doneTs || g.doneDay === today))
      .sort((a, b) => Number(Boolean(a.doneTs)) - Number(Boolean(b.doneTs)) || a.ts - b.ts);
  }, [today]);

  const recurring = useLiveQuery(async () => {
    const all = await db.gigTemplates.toArray();
    return all.filter((t) => !t.retiredTs).sort((a, b) => a.ts - b.ts);
  }, []);

  // Quick-add templates: the user's own distinct past gig text ("do the dishes"
  // shows up after the first time you type it). Zero schema, ADHD-simple.
  const templates = useLiveQuery(async () => {
    const all = await db.gigs.toArray();
    return [...new Set(all.map((g) => g.text))].slice(0, 50);
  }, []);

  const canAdd = Boolean(text.trim()) && (!repeat || days.length > 0);

  const submit = async () => {
    if (!canAdd) return;
    if (repeat) {
      await addGigTemplate(text, days);
      await spawnGigsFromTemplates(today); // lands on the board right away if today matches
    } else {
      await addGig(text);
    }
    setText("");
    setRepeat(false);
    setDays(ALL_DOW);
  };

  return (
    <div className="card">
      <h2 className="card-title">Gigs — today's jobs</h2>
      {(gigs ?? []).map((g) => (
        <div className={g.doneTs ? "gig-row done" : "gig-row"} key={g.id}>
          <label className="gig-main">
            <input
              type="checkbox"
              checked={Boolean(g.doneTs)}
              onChange={(e) => toggleGig(g.id, e.target.checked)}
              aria-label={`Complete ${g.text}`}
            />
            <span className="gig-text">{g.text}</span>
            {g.templateId && <span className="gig-cadence" title="Recurring gig">↻</span>}
          </label>
          <button className="link-btn" onClick={() => deleteGig(g.id)} aria-label={`Delete ${g.text}`}>
            ✕
          </button>
        </div>
      ))}
      <div className="form-row">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="New gig — type or pick a template…"
          aria-label="New gig"
          list="gig-templates"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <datalist id="gig-templates">
          {(templates ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          className={repeat ? "chip on" : "chip"}
          onClick={() => setRepeat(!repeat)}
          aria-pressed={repeat}
          title="Repeat on a schedule"
          aria-label="Repeat on a schedule"
        >
          ↻
        </button>
        <button className="btn" onClick={submit} disabled={!canAdd}>
          Add
        </button>
      </div>
      {repeat && (
        <div className="chip-row" role="group" aria-label="Repeat on days">
          {ALL_DOW.map((d) => (
            <button
              key={d}
              className={days.includes(d) ? "chip on" : "chip"}
              aria-pressed={days.includes(d)}
              onClick={() =>
                setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
              }
            >
              {GIG_DOW_LABELS[d]}
            </button>
          ))}
        </div>
      )}
      {(recurring ?? []).length > 0 && (
        <>
          <p className="gig-recur-title">Recurring</p>
          {recurring!.map((t) => (
            <div className="gig-row" key={t.id}>
              <span className="gig-text dim">
                ↻ {t.text} — {cadenceLabel(t.days)}
              </span>
              <button
                className="link-btn"
                onClick={() => retireGigTemplate(t.id)}
                aria-label={`Stop repeating ${t.text}`}
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
