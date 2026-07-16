import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey } from "../../engine/index.ts";
import { addGig, deleteGig, toggleGig } from "../../db/repo.ts";

/** Bullet-journal gigs: today's jobs. Unfinished gigs from previous days
 *  simply stay on the board (that's the rollover) — no shame markers, they're
 *  just still open. Tasks, not habits: no streaks attached. */
export function GigList({ today }: { today: DayKey }) {
  const [text, setText] = useState("");

  const gigs = useLiveQuery(async () => {
    const all = await db.gigs.toArray();
    // Board = open gigs (not retired) from any day + gigs completed today;
    // older completions and migrated-away gigs drop off.
    return all
      .filter((g) => !g.retiredDay && (!g.doneTs || g.doneDay === today))
      .sort((a, b) => Number(Boolean(a.doneTs)) - Number(Boolean(b.doneTs)) || a.ts - b.ts);
  }, [today]);

  // Quick-add templates: the user's own distinct past gig text ("do the dishes"
  // shows up after the first time you type it). Zero schema, ADHD-simple.
  const templates = useLiveQuery(async () => {
    const all = await db.gigs.toArray();
    return [...new Set(all.map((g) => g.text))].slice(0, 50);
  }, []);

  const submit = async () => {
    await addGig(text);
    setText("");
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
        <button className="btn" onClick={submit} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
