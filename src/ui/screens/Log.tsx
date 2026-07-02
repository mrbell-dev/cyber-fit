import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { ReadingItem, ReadingLog } from "../../engine/index.ts";
import { addReadingItem, logReading, logWorkout, setReadingStatus } from "../../db/repo.ts";
import { useDayKey } from "../hooks.ts";

function WorkoutCard() {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const today = useDayKey();

  const recent = useLiveQuery(async () => {
    const all = await db.workoutLogs.toArray();
    return all.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, []);
  const pastNames = [...new Set((recent ?? []).map((w) => w.name))];

  const submit = async () => {
    if (!name.trim()) return;
    await logWorkout({ name, durationMin: Number(minutes) || undefined });
    setName("");
    setMinutes("");
  };

  return (
    <div className="card">
      <h2 className="card-title">Physical Training</h2>
      <div className="form-row">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you do? (e.g. Lift, 5k walk)"
          aria-label="Workout name"
          list="past-workouts"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <datalist id="past-workouts">
          {pastNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <input
          className="input num-input"
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="min"
          aria-label="Duration in minutes"
        />
      </div>
      <button className="btn" onClick={submit} disabled={!name.trim()}>
        Log workout
      </button>

      {(recent ?? []).length > 0 && (
        <div className="recent-list">
          {recent!.map((w) => (
            <div className="row-item" key={w.id}>
              <span>
                {w.dayKey === today ? "▸ " : ""}
                {w.name}
                {w.durationMin ? ` · ${w.durationMin} min` : ""}
              </span>
              <span className="off-day-tag">{w.dayKey}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEELINGS: { value: NonNullable<ReadingLog["feeling"]>; glyph: string; label: string }[] = [
  { value: 1, glyph: "▁", label: "Rough" },
  { value: 2, glyph: "▃", label: "Meh" },
  { value: 3, glyph: "▅", label: "Fine" },
  { value: 4, glyph: "▇", label: "Good" },
  { value: 5, glyph: "█", label: "Mind-blown" },
];

function SessionForm({ item, onDone }: { item: ReadingItem | null; onDone: () => void }) {
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [feeling, setFeeling] = useState<ReadingLog["feeling"]>();

  const submit = async () => {
    await logReading({
      itemId: item?.id,
      minutes: Number(minutes) || undefined,
      note,
      feeling,
    });
    onDone();
  };

  return (
    <div className="session-form">
      <div className="form-row">
        <input
          className="input num-input"
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="min"
          aria-label="Minutes read"
        />
        <div className="feeling-row" role="group" aria-label="How did it land?">
          {FEELINGS.map((f) => (
            <button
              key={f.value}
              className={feeling === f.value ? "mood-btn on" : "mood-btn"}
              aria-pressed={feeling === f.value}
              title={f.label}
              aria-label={f.label}
              onClick={() => setFeeling(f.value)}
            >
              <span className="mood-glyph" aria-hidden="true">{f.glyph}</span>
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="input note-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did it say? How did it make you feel? (+bonus XP for reflecting)"
        aria-label="Post-reading note"
        rows={2}
      />
      <div className="form-row">
        <button className="btn" onClick={submit}>
          Log session
        </button>
        <button className="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReadingCard() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ReadingItem["type"]>("book");
  const [sessionFor, setSessionFor] = useState<string | null>(null); // item id or "none"

  const items = useLiveQuery(
    () => db.readingItems.where("status").equals("reading").toArray(),
    [],
  );
  const recentLogs = useLiveQuery(async () => {
    const all = await db.readingLogs.toArray();
    return all.sort((a, b) => b.ts - a.ts).slice(0, 3);
  }, []);
  const itemById = new Map((items ?? []).map((i) => [i.id, i]));

  const add = async () => {
    if (!title.trim()) return;
    await addReadingItem({ title, type });
    setTitle("");
  };

  return (
    <div className="card">
      <h2 className="card-title">Reading / Learning Feed</h2>

      {(items ?? []).map((item) => (
        <div key={item.id}>
          <div className="row-item">
            <span>
              {item.type === "book" ? "📖" : item.type === "article" ? "📄" : item.type === "audiobook" ? "🎧" : "◈"}{" "}
              {item.title}
            </span>
            <span className="row-actions">
              <button className="link-btn" onClick={() => setSessionFor(item.id)}>
                log session
              </button>
              <button className="link-btn" onClick={() => setReadingStatus(item.id, "finished")}>
                finish
              </button>
            </span>
          </div>
          {sessionFor === item.id && (
            <SessionForm item={itemById.get(item.id) ?? null} onDone={() => setSessionFor(null)} />
          )}
        </div>
      ))}

      <div className="row-item">
        <span className="off-day-tag">Quick session, no title</span>
        <button className="link-btn" onClick={() => setSessionFor("none")}>
          log session
        </button>
      </div>
      {sessionFor === "none" && <SessionForm item={null} onDone={() => setSessionFor(null)} />}

      <div className="form-block">
        <div className="form-row">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a book / article…"
            aria-label="Reading title"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select
            className="input type-select"
            value={type}
            onChange={(e) => setType(e.target.value as ReadingItem["type"])}
            aria-label="Type"
          >
            <option value="book">book</option>
            <option value="article">article</option>
            <option value="audiobook">audio</option>
            <option value="other">other</option>
          </select>
        </div>
        <button className="btn" onClick={add} disabled={!title.trim()}>
          Add to feed
        </button>
      </div>

      {(recentLogs ?? []).length > 0 && (
        <div className="recent-list">
          {recentLogs!.map((l) => (
            <div className="row-item" key={l.id}>
              <span className="off-day-tag">
                {l.dayKey} · {l.itemId ? (itemById.get(l.itemId)?.title ?? "session") : "session"}
                {l.minutes ? ` · ${l.minutes} min` : ""}
                {l.note ? " · 📝" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Log() {
  return (
    <section aria-label="Log">
      <WorkoutCard />
      <ReadingCard />
    </section>
  );
}
