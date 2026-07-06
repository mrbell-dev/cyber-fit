import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  EXERCISES,
  WORKOUT_STYLES,
  type ReadingItem,
  type ReadingLog,
  type WorkoutLog,
} from "../../engine/index.ts";
import { addReadingItem, logReading, logWorkout, setReadingStatus } from "../../db/repo.ts";
import { useDayKey, useSettings } from "../hooks.ts";
import { VolumeChart } from "../components/BodyMetrics.tsx";
import { BioScanCard } from "../components/BioMetrics.tsx";
import { ScreenerCard } from "../components/Screeners.tsx";
import { InfoButton, InfoSheet } from "../components/InfoSheet.tsx";

type SetRow = { reps: string; weight: string };

function WorkoutCard() {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [style, setStyle] = useState<NonNullable<WorkoutLog["style"]>>("sets");
  const [score, setScore] = useState("");
  const [sets, setSets] = useState<SetRow[]>([{ reps: "", weight: "" }]);
  const [templated, setTemplated] = useState(false);
  const [info, setInfo] = useState(false);
  const today = useDayKey();
  const settings = useSettings();
  const distanceUnit = settings.distanceUnit ?? "mi";

  const history = useLiveQuery(async () => {
    const all = await db.workoutLogs.toArray();
    return all.sort((a, b) => b.ts - a.ts);
  }, []);
  const recent = history?.slice(0, 5);
  // Your ENTIRE workout history feeds autocomplete (custom names included),
  // then the bundled offline exercise vocabulary.
  const pastNames = [...new Set((history ?? []).map((w) => w.name))];
  const suggestions = [...pastNames, ...EXERCISES.filter((e) => !pastNames.includes(e))];
  const styleDef = WORKOUT_STYLES.find((s) => s.id === style)!;

  /** Template: repeating a known workout pre-fills the last session. */
  const onName = (value: string) => {
    setName(value);
    const last = (history ?? []).find((w) => w.name === value);
    if (!last) {
      setTemplated(false);
      return;
    }
    setStyle(last.style ?? "sets");
    setScore(last.score ?? "");
    setMinutes(last.durationMin ? String(last.durationMin) : "");
    setDistance(last.distance ? String(last.distance) : "");
    const lastSets = last.exercises?.[0]?.sets;
    if (lastSets?.length) {
      setSets(lastSets.map((s) => ({ reps: String(s.reps ?? ""), weight: String(s.weight ?? "") })));
    }
    setTemplated(true);
  };

  const submit = async () => {
    if (!name.trim()) return;
    const filledSets = sets
      .filter((s) => Number(s.reps) || Number(s.weight))
      .map((s) => ({
        ...(Number(s.reps) ? { reps: Number(s.reps) } : {}),
        ...(Number(s.weight) ? { weight: Number(s.weight) } : {}),
      }));
    await logWorkout({
      name,
      style,
      score: styleDef.fields.score ? score : "",
      durationMin: styleDef.fields.duration ? Number(minutes) || undefined : undefined,
      distance: styleDef.fields.distance ? Number(distance) || undefined : undefined,
      exercises: styleDef.fields.sets && filledSets.length
        ? [{ name: name.trim(), sets: filledSets }]
        : undefined,
    });
    setName("");
    setMinutes("");
    setDistance("");
    setScore("");
    setSets([{ reps: "", weight: "" }]);
    setTemplated(false);
  };

  const hasHistory = (history ?? []).length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Physical Training</h2>
        {hasHistory && <InfoButton onClick={() => setInfo(true)} label="Training volume + history" />}
      </div>
      {info && (
        <InfoSheet title="Training Volume" onClose={() => setInfo(false)}>
          <VolumeChart today={today} />
        </InfoSheet>
      )}
      <div className="form-row">
        <input
          className="input"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="What did you do? (e.g. Lift, 5k walk)"
          aria-label="Workout name"
          list="past-workouts"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <datalist id="past-workouts">
          {suggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="chip-row" role="group" aria-label="Workout style">
        {WORKOUT_STYLES.map((s) => (
          <button
            key={s.id}
            className={style === s.id ? "chip on" : "chip"}
            aria-pressed={style === s.id}
            onClick={() => setStyle(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {templated && (
        <p className="placeholder">// loaded from last time — tweak and log (progressive overload, choom)</p>
      )}
      {styleDef.fields.score && (
        <div className="form-row">
          <input
            className="input"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder={`score — ${styleDef.scoreHint}`}
            aria-label="Score or result"
          />
        </div>
      )}
      {styleDef.fields.sets && (
        <div className="sets-grid" role="group" aria-label="Sets">
          {sets.map((s, i) => (
            <div className="form-row" key={i}>
              <span className="off-day-tag set-num">set {i + 1}</span>
              <input
                className="input num-input"
                type="number"
                min={0}
                value={s.reps}
                onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                placeholder="reps"
                aria-label={`Set ${i + 1} reps`}
              />
              ×
              <input
                className="input num-input"
                type="number"
                inputMode="decimal"
                min={0}
                value={s.weight}
                onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))}
                placeholder={settings.weightUnit ?? "lbs"}
                aria-label={`Set ${i + 1} weight`}
              />
            </div>
          ))}
          <button className="link-btn" onClick={() => setSets([...sets, sets[sets.length - 1] ?? { reps: "", weight: "" }])}>
            + add set (repeats last)
          </button>
        </div>
      )}
      <div className="form-row">
        {styleDef.fields.duration && (
          <input
            className="input num-input"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="min"
            aria-label="Duration in minutes"
          />
        )}
        {styleDef.fields.distance && (
          <input
            className="input num-input"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder={distanceUnit}
            aria-label={`Distance in ${distanceUnit}`}
          />
        )}
        <button className="btn" onClick={submit} disabled={!name.trim()}>
          Log workout
        </button>
      </div>

      {(recent ?? []).length > 0 && (
        <div className="recent-list">
          {recent!.map((w) => (
            <div className="row-item" key={w.id}>
              <span>
                {w.dayKey === today ? "▸ " : ""}
                {w.name}
                {w.style ? ` · ${WORKOUT_STYLES.find((s) => s.id === w.style)?.label ?? w.style}` : ""}
                {w.score ? ` · ${w.score}` : ""}
                {w.durationMin ? ` · ${w.durationMin} min` : ""}
                {w.distance ? ` · ${w.distance} ${distanceUnit}` : ""}
              </span>
              <span className="off-day-tag">{w.dayKey}</span>
            </div>
          ))}
        </div>
      )}
      <p className="placeholder">
        // any name you type is saved to your own history — the list above is just suggestions.
        drop #tags in names and notes to slice them later
      </p>
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
          aria-label="Session minutes"
        />
        <span className="placeholder">how did it land?</span>
      </div>
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
            <span className="mood-label">{f.label}</span>
          </button>
        ))}
      </div>
      <textarea
        className="input note-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did it say? How did it land? #tags work (+bonus XP for reflecting)"
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

const READING_ICONS: Record<string, string> = {
  book: "📖", article: "📄", audiobook: "🎧", video: "🎬", studying: "✍️", class: "🎓",
};
const readingIcon = (t: string) => READING_ICONS[t] ?? "◈";

const LIBRARY_TYPES: (ReadingItem["type"] | "all")[] = [
  "all", "book", "audiobook", "video", "article", "studying", "class", "other",
];

/** The whole shelf — every item ever added, filterable by type, across all
 *  statuses. The "find that book/movie I wanted to recommend" view. */
function ReadingLibrary() {
  const [filter, setFilter] = useState<ReadingItem["type"] | "all">("all");
  const all = useLiveQuery(async () => {
    const rows = await db.readingItems.toArray();
    return rows.sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));
  }, []);
  if (!all) return null;
  const shown = filter === "all" ? all : all.filter((i) => i.type === filter);

  return (
    <>
      <div className="chip-row" role="group" aria-label="Filter by type">
        {LIBRARY_TYPES.filter((t) => t === "all" || all.some((i) => i.type === t)).map((t) => (
          <button
            key={t}
            className={filter === t ? "chip on" : "chip"}
            aria-pressed={filter === t}
            onClick={() => setFilter(t)}
          >
            {t === "all" ? "all" : `${readingIcon(t)} ${t}`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="placeholder">// nothing here yet — add items from the feed</p>
      ) : (
        <div className="history-list">
          {shown.map((item) => (
            <div className="row-item" key={item.id}>
              <span>
                {readingIcon(item.type)} {item.title}
                {item.author ? <span className="off-day-tag"> · {item.author}</span> : null}
              </span>
              <span className="row-actions">
                <span className="off-day-tag">{item.status}</span>
                {item.status !== "reading" && (
                  <button className="link-btn" onClick={() => setReadingStatus(item.id, "reading")}>
                    reopen
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ReadingCard() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ReadingItem["type"]>("book");
  const [sessionFor, setSessionFor] = useState<string | null>(null); // item id or "none"
  const [library, setLibrary] = useState(false);
  const [oneShot, setOneShot] = useState(false);
  const [oneShotItem, setOneShotItem] = useState<ReadingItem | null>(null);

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
    if (oneShot) {
      // One-time thing: create it already finished and drop straight into a
      // session log (feeling) — it never sits in the feed waiting for "finish".
      const item = await addReadingItem({ title, type });
      await setReadingStatus(item.id, "finished");
      setOneShotItem(item);
      setTitle("");
      return;
    }
    await addReadingItem({ title, type });
    setTitle("");
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Reading / Learning Feed</h2>
        <InfoButton onClick={() => setLibrary(true)} label="Full library" />
      </div>
      {library && (
        <InfoSheet title="Library" onClose={() => setLibrary(false)}>
          <ReadingLibrary />
        </InfoSheet>
      )}

      {(items ?? []).map((item) => (
        <div key={item.id}>
          <div className="row-item">
            <span>
              {readingIcon(item.type as string)}{" "}
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
            <option value="audiobook">audio</option>
            <option value="video">video</option>
            <option value="article">article</option>
            <option value="studying">studying</option>
            <option value="class">class</option>
            <option value="other">other</option>
          </select>
        </div>
        <label className="check-label">
          <input type="checkbox" checked={oneShot} onChange={(e) => setOneShot(e.target.checked)} />
          One-time thing — log it and done, don't keep it in the feed
        </label>
        <button className="btn" onClick={add} disabled={!title.trim()}>
          {oneShot ? "Log it & done" : "Add to feed"}
        </button>
        {oneShotItem && (
          <SessionForm
            item={oneShotItem}
            onDone={() => {
              setOneShotItem(null);
              setOneShot(false);
            }}
          />
        )}
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
  const today = useDayKey();
  return (
    <section aria-label="Log">
      <WorkoutCard />
      <BioScanCard today={today} />
      <ScreenerCard />
      <ReadingCard />
    </section>
  );
}
