import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey } from "../../engine/index.ts";
import { logHighlight, logJournal } from "../../db/repo.ts";

/** Some days you pick one good frame; some days you need to dump the buffer.
 *  Highlight = savoring practice; Journal = catharsis. Both count. */
export function Highlight({ today }: { today: DayKey }) {
  const [mode, setMode] = useState<"highlight" | "journal">("highlight");
  const [text, setText] = useState("");
  const [journalText, setJournalText] = useState("");

  const todays = useLiveQuery(async () => {
    const logs = await db.highlightLogs.where({ dayKey: today }).toArray();
    return logs.sort((a, b) => a.ts - b.ts);
  }, [today]);
  const todaysJournal = useLiveQuery(async () => {
    const logs = await db.journalLogs.where({ dayKey: today }).toArray();
    return logs.sort((a, b) => b.ts - a.ts);
  }, [today]);

  const submit = async () => {
    await logHighlight(text);
    setText("");
  };

  const submitJournal = async () => {
    await logJournal(journalText);
    setJournalText("");
  };

  if (mode === "journal") {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Journal</h2>
          <button className="link-btn" onClick={() => setMode("highlight")}>
            ⇄ highlight
          </button>
        </div>
        <textarea
          className="input note-input"
          value={journalText}
          onChange={(e) => setJournalText(e.target.value)}
          placeholder="Dump the buffer — whatever's running in the background. #tags work here."
          aria-label="Journal entry"
          rows={4}
        />
        <button className="btn" onClick={submitJournal} disabled={!journalText.trim()}>
          Commit entry
        </button>
        {(todaysJournal ?? []).map((j) => (
          <p className="highlight-text reel" key={j.id}>
            <span className="off-day-tag">
              {new Date(j.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>{" "}
            {j.text}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Highlight of the Day</h2>
        <button className="link-btn" onClick={() => setMode("journal")}>
          ⇄ journal
        </button>
      </div>
      {todays && todays.length > 0 ? (
        <>
          {todays.map((h) => (
            <p className="highlight-text" key={h.id}>◆ {h.text}</p>
          ))}
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
          placeholder={todays?.length ? "Another one? (#tags work)" : "Today's highlight… (#tags work)"}
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

/** Last 28 days of highlights — the reel is the dialectical payoff. */
export function HighlightReel() {
  const recent = useLiveQuery(async () => {
    const all = await db.highlightLogs.toArray();
    const cutoff = Date.now() - 28 * 86_400_000;
    return all.filter((h) => h.ts >= cutoff).sort((a, b) => b.ts - a.ts).slice(0, 28);
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
