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
    // Open gigs from any day + gigs completed today; older completions retire.
    return all
      .filter((g) => !g.doneTs || g.doneDay === today)
      .sort((a, b) => Number(Boolean(a.doneTs)) - Number(Boolean(b.doneTs)) || a.ts - b.ts);
  }, [today]);

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
            {!g.doneTs && g.createdDay < today && (
              <span className="off-day-tag">· carried over</span>
            )}
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
          placeholder="New gig… (one-off job, not a habit)"
          aria-label="New gig"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
