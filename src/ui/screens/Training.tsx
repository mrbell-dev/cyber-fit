import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { EXERCISES, WORKOUT_STYLES, type WorkoutLog } from "../../engine/index.ts";
import { logWorkout } from "../../db/repo.ts";
import { useDayKey, useSettings } from "../hooks.ts";
import { VolumeChart } from "../components/BodyMetrics.tsx";
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
  const [repeated, setRepeated] = useState<string | null>(null);
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

  /** One-tap repeat (eval rec #5): logs the last session again as-is —
   *  same style/sets/duration/distance. `score` is deliberately NOT copied:
   *  a score is a result you got that day, not part of the workout's shape. */
  const repeatLast = async () => {
    const last = history?.[0];
    if (!last) return;
    await logWorkout({
      name: last.name,
      style: last.style,
      durationMin: last.durationMin,
      distance: last.distance,
      exercises: last.exercises,
    });
    setRepeated(last.name);
    setTimeout(() => setRepeated(null), 3000);
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

      {history?.[0] && (
        <button className="btn ghost repeat-last" onClick={repeatLast}>
          ↻ Repeat last — {history[0].name}
        </button>
      )}
      {repeated && (
        <p className="placeholder">// logged "{repeated}" again — same shape as last time</p>
      )}

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

export function Training() {
  return (
    <section aria-label="Training">
      <WorkoutCard />
    </section>
  );
}
