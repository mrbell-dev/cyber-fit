import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey, JournalLog } from "../../engine/index.ts";
import { deleteJournal, logHighlight, logJournal, updateJournal } from "../../db/repo.ts";
import { InfoSheet } from "./InfoSheet.tsx";

/** Review / edit / delete a single journal entry. Editing changes only the
 *  text (the entry's day + XP are untouched); delete re-folds. */
function JournalEntryModal({ entry, onClose }: { entry: JournalLog; onClose: () => void }) {
  const [text, setText] = useState(entry.text);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    await updateJournal(entry.id, text);
    onClose();
  };

  return (
    <InfoSheet title={`Entry · ${entry.dayKey}`} onClose={onClose}>
      <textarea
        className="input note-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Edit journal entry"
        rows={8}
        autoFocus
      />
      <div className="form-row">
        <button className="btn" onClick={save} disabled={!text.trim()}>
          Save
        </button>
        {confirmDel ? (
          <button className="btn ghost danger" onClick={async () => { await deleteJournal(entry.id); onClose(); }}>
            confirm delete
          </button>
        ) : (
          <button className="btn ghost" onClick={() => setConfirmDel(true)}>
            Delete
          </button>
        )}
      </div>
    </InfoSheet>
  );
}

/** Some days you pick one good frame; some days you need to dump the buffer.
 *  Highlight = savoring practice; Journal = catharsis. Both count. */
export function Highlight({ today }: { today: DayKey }) {
  const [mode, setMode] = useState<"highlight" | "journal">("highlight");
  const [text, setText] = useState("");
  const [journalText, setJournalText] = useState("");
  const [editEntry, setEditEntry] = useState<JournalLog | null>(null);

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
        {editEntry && <JournalEntryModal entry={editEntry} onClose={() => setEditEntry(null)} />}
        {(todaysJournal ?? []).map((j) => (
          <button className="journal-entry" key={j.id} onClick={() => setEditEntry(j)}>
            <span className="off-day-tag">
              {new Date(j.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · tap to edit
            </span>
            <span className="journal-clip">{j.text}</span>
          </button>
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

/** Full highlight history in a sheet — searchable, since the reel is the
 *  point: proof the good frames were real. */
function HighlightArchive() {
  const [q, setQ] = useState("");
  const all = useLiveQuery(async () => {
    const rows = await db.highlightLogs.toArray();
    return rows.sort((a, b) => b.ts - a.ts);
  }, []);
  if (!all) return null;
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((h) => h.text.toLowerCase().includes(needle)) : all;

  return (
    <>
      <input
        className="input mood-note"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search highlights (try a #tag)…"
        aria-label="Search highlights"
      />
      {shown.length === 0 ? (
        <p className="placeholder">// no matches</p>
      ) : (
        <div className="history-list">
          {shown.map((h) => (
            <p className="highlight-text reel" key={h.id}>
              <span className="off-day-tag">{h.dayKey}</span> ◆ {h.text}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

/** The reel: last 10 highlights, with a door to the full archive. */
export function HighlightReel() {
  const [archive, setArchive] = useState(false);
  const data = useLiveQuery(async () => {
    const all = await db.highlightLogs.toArray();
    const sorted = all.sort((a, b) => b.ts - a.ts);
    return { recent: sorted.slice(0, 10), total: sorted.length };
  }, []);

  if (!data || data.total === 0) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Highlight Reel</h2>
        {data.total > 10 && (
          <button className="link-btn" onClick={() => setArchive(true)}>
            view all ({data.total})
          </button>
        )}
      </div>
      {archive && (
        <InfoSheet title="Highlight Archive" onClose={() => setArchive(false)}>
          <HighlightArchive />
        </InfoSheet>
      )}
      {data.recent.map((h) => (
        <p className="highlight-text reel" key={h.id}>
          <span className="off-day-tag">{h.dayKey}</span> ◆ {h.text}
        </p>
      ))}
      <p className="placeholder">// evidence against the all-or-nothing feed</p>
    </div>
  );
}
