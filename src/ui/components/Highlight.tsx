import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey } from "../../engine/index.ts";
import { logHighlight } from "../../db/repo.ts";

/** One small good thing per day. Evidence-based savoring practice — trains
 *  the "the day wasn't all bad" muscle. */
export function Highlight({ today }: { today: DayKey }) {
  const [text, setText] = useState("");

  const todays = useLiveQuery(async () => {
    const logs = await db.highlightLogs.where({ dayKey: today }).toArray();
    return logs.sort((a, b) => b.ts - a.ts)[0];
  }, [today]);

  const submit = async () => {
    await logHighlight(text);
    setText("");
  };

  return (
    <div className="card">
      <h2 className="card-title">Highlight of the Day</h2>
      {todays ? (
        <>
          <p className="highlight-text">◆ {todays.text}</p>
          <p className="placeholder">// captured. one good frame is enough — add another if it was that kind of day</p>
        </>
      ) : (
        <p className="placeholder">
          // one small good thing from today — the coffee, a lizard on the patio, anything real
        </p>
      )}
      <div className="form-row">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={todays ? "Another one?" : "Today's highlight…"}
          aria-label="Highlight of the day"
          maxLength={200}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit} disabled={!text.trim()}>
          Save
        </button>
      </div>
    </div>
  );
}

/** Last handful of highlights — the reel is the dialectical payoff. */
export function HighlightReel() {
  const recent = useLiveQuery(async () => {
    const all = await db.highlightLogs.toArray();
    return all.sort((a, b) => b.ts - a.ts).slice(0, 7);
  }, []);

  if (!recent || recent.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Highlight Reel</h2>
      {recent.map((h) => (
        <p className="highlight-text reel" key={h.id}>
          <span className="off-day-tag">{h.dayKey}</span> ◆ {h.text}
        </p>
      ))}
      <p className="placeholder">// evidence against the all-or-nothing feed</p>
    </div>
  );
}
