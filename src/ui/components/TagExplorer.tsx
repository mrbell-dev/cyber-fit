import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  filterByTags,
  parseTags,
  stripTags,
  tagCounts,
  type TaggedEntry,
} from "../../engine/index.ts";

const KIND_ICON: Record<TaggedEntry["kind"], string> = {
  workout: "⚡",
  reading: "📖",
  highlight: "◆",
  mood: "▥",
};

/** #tag explorer: select multiple tags to intersect — #lift ∩ #workout shows
 *  only entries carrying both. Tags come from anywhere you type them. */
export function TagExplorer() {
  const [selected, setSelected] = useState<string[]>([]);

  const entries = useLiveQuery(async () => {
    const [workouts, readings, highlights, moods] = await Promise.all([
      db.workoutLogs.toArray(),
      db.readingLogs.toArray(),
      db.highlightLogs.toArray(),
      db.moodLogs.toArray(),
    ]);
    const out: TaggedEntry[] = [];
    for (const w of workouts) {
      const text = [w.name, w.note].filter(Boolean).join(" ");
      out.push({ kind: "workout", ts: w.ts, dayKey: w.dayKey, text, tags: parseTags(text) });
    }
    for (const r of readings) {
      if (!r.note) continue;
      out.push({ kind: "reading", ts: r.ts, dayKey: r.dayKey, text: r.note, tags: parseTags(r.note) });
    }
    for (const h of highlights) {
      out.push({ kind: "highlight", ts: h.ts, dayKey: h.dayKey, text: h.text, tags: parseTags(h.text) });
    }
    for (const m of moods) {
      if (!m.note) continue;
      out.push({ kind: "mood", ts: m.ts, dayKey: m.dayKey, text: m.note, tags: parseTags(m.note) });
    }
    return out;
  }, []);

  if (!entries) return null;
  const counts = tagCounts(entries);
  if (counts.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Tag Explorer</h2>
        <p className="placeholder">
          // drop #tags anywhere you type — "Deadlifts #lift #workout" — then slice your data here
        </p>
      </div>
    );
  }

  const toggle = (tag: string) =>
    setSelected(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);

  const hits = filterByTags(entries, selected).slice(0, 20);

  return (
    <div className="card">
      <h2 className="card-title">Tag Explorer</h2>
      <div className="chip-row" role="group" aria-label="Tags">
        {counts.slice(0, 14).map(({ tag, count }) => (
          <button
            key={tag}
            className={selected.includes(tag) ? "chip on" : "chip"}
            aria-pressed={selected.includes(tag)}
            onClick={() => toggle(tag)}
          >
            #{tag} <span className="off-day-tag">{count}</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="placeholder">
          // {hits.length} match{hits.length === 1 ? "" : "es"} for {selected.map((t) => `#${t}`).join(" ∩ ")}
        </p>
      )}
      {hits.map((e) => (
        <div className="row-item" key={`${e.kind}-${e.ts}`}>
          <span>
            {KIND_ICON[e.kind]} {stripTags(e.text)}
            <span className="off-day-tag"> · {e.tags.map((t) => `#${t}`).join(" ")}</span>
          </span>
          <span className="off-day-tag">{e.dayKey}</span>
        </div>
      ))}
    </div>
  );
}
