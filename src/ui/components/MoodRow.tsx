import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey, MoodLog } from "../../engine/index.ts";
import { logMood } from "../../db/repo.ts";

const MOODS: { rating: MoodLog["rating"]; glyph: string; label: string }[] = [
  { rating: 1, glyph: "▁", label: "Critical" },
  { rating: 2, glyph: "▃", label: "Low power" },
  { rating: 3, glyph: "▅", label: "Stable" },
  { rating: 4, glyph: "▇", label: "Charged" },
  { rating: 5, glyph: "█", label: "Overclocked" },
];

export function MoodRow({ today }: { today: DayKey }) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const readings = useLiveQuery(async () => {
    const logs = await db.moodLogs.where({ dayKey: today }).toArray();
    return logs.sort((a, b) => a.ts - b.ts);
  }, [today]);
  const todayMood = readings?.[readings.length - 1];

  const check = async (rating: MoodLog["rating"]) => {
    await logMood(rating, note.trim() ? { note } : {});
    setNote("");
    setShowNote(false);
  };

  return (
    <div className="card">
      <h2 className="card-title">Vitals</h2>
      <div className="mood-row" role="group" aria-label="How are you running today?">
        {MOODS.map((m) => (
          <button
            key={m.rating}
            className={todayMood?.rating === m.rating ? "mood-btn on" : "mood-btn"}
            aria-pressed={todayMood?.rating === m.rating}
            aria-label={m.label}
            title={m.label}
            onClick={() => check(m.rating)}
          >
            <span className="mood-glyph" aria-hidden="true">
              {m.glyph}
            </span>
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>
      {showNote ? (
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional log entry — what's running in the background?"
          aria-label="Mood note"
        />
      ) : (
        <button className="link-btn" onClick={() => setShowNote(true)}>
          + add a note
        </button>
      )}
      {(readings ?? []).length > 0 && (
        <div className="vitals-trace">
          {readings!.map((r, i) => (
            <span
              key={r.id}
              className={i === readings!.length - 1 ? "vitals-reading latest" : "vitals-reading"}
            >
              {new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
              {MOODS.find((m) => m.rating === r.rating)?.glyph}
              {r.note ? ` · ${r.note}` : ""}
            </span>
          ))}
          <span className="off-day-tag">// vitals shift all day — log as many readings as you need</span>
        </div>
      )}
    </div>
  );
}
