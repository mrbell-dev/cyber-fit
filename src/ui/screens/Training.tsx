import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  EXERCISES,
  WORKOUT_STYLES,
  workoutBlocks,
  type WorkoutBlockView,
  type WorkoutLog,
  type WorkoutMovement,
  type WorkoutPart,
  type WorkoutStyleId,
} from "../../engine/index.ts";
import { deleteWorkout, logWorkout, saveSettings, updateWorkout } from "../../db/repo.ts";
import { addDays } from "../../engine/time.ts";
import { useDayKey, useSettings } from "../hooks.ts";
import { WorkoutGrid } from "../components/BodyMetrics.tsx";
import { InfoSheet } from "../components/InfoSheet.tsx";

type SetRow = { reps: string; weight: string };
type DistUnit = "mi" | "km";
type WtUnit = "lbs" | "kg";
/** One movement inside a block. Which fields apply depends on the BLOCK's type:
 *  a sets block uses sets+wtUnit; a metcon block uses reps; others list names. */
type MoveDraft = { name: string; reps: string; sets: SetRow[]; wtUnit: WtUnit };
/** A block: a typed, homogeneous group. The block owns the type + block-level
 *  result (score/time/distance/note); its movements live in `moves`. */
type BlockDraft = {
  name: string;
  style: WorkoutStyleId;
  minutes: string;
  distance: string;
  distUnit: DistUnit;
  moves: MoveDraft[];
};
type Units = { dist: DistUnit; wt: WtUnit };

/** Effort gauge — a power-draw ramp (light → all-out). Low is a fine recovery
 *  day, not a failure; high reads as an achievement. Same glyphs as Vitals. */
const EFFORT: { v: NonNullable<WorkoutLog["intensity"]>; glyph: string; label: string }[] = [
  { v: 1, glyph: "▁", label: "Idle" },
  { v: 2, glyph: "▃", label: "Low draw" },
  { v: 3, glyph: "▅", label: "Cruising" },
  { v: 4, glyph: "▇", label: "Redlined" },
  { v: 5, glyph: "█", label: "Overclocked" },
];

const SET_COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);
const METCON: WorkoutStyleId[] = ["amrap", "emom", "fortime", "tabata"];
const isSets = (s: WorkoutStyleId) => s === "sets";
const isMetcon = (s: WorkoutStyleId) => METCON.includes(s);

const emptyMove = (units: Units = { dist: "mi", wt: "lbs" }): MoveDraft => ({
  name: "",
  reps: "",
  sets: [{ reps: "", weight: "" }],
  wtUnit: units.wt,
});

const emptyBlock = (units: Units, style: WorkoutStyleId = "general"): BlockDraft => ({
  name: "",
  style,
  minutes: "",
  distance: "",
  distUnit: units.dist,
  moves: [emptyMove(units)],
});

const moveToDraft = (m: WorkoutMovement, units: Units): MoveDraft => ({
  name: m.name ?? "",
  reps: m.reps ? String(m.reps) : "",
  sets: m.sets?.length
    ? m.sets.map((s) => ({ reps: String(s.reps ?? ""), weight: String(s.weight ?? "") }))
    : [{ reps: "", weight: "" }],
  wtUnit: m.weightUnit ?? units.wt,
});

const blockToDraft = (blk: WorkoutBlockView, units: Units): BlockDraft => ({
  name: blk.name ?? "",
  style: blk.style,
  minutes: blk.durationMin ? String(blk.durationMin) : "",
  distance: blk.distance ? String(blk.distance) : "",
  distUnit: blk.distanceUnit ?? units.dist,
  moves: blk.movements.length ? blk.movements.map((m) => moveToDraft(m, units)) : [emptyMove(units)],
});

/** Draft block → stored part, keeping only the fields its type uses and that
 *  were filled. Returns null for an empty block (dropped at log time). */
const buildBlock = (b: BlockDraft, block: string): WorkoutPart | null => {
  const def = WORKOUT_STYLES.find((s) => s.id === b.style)!;
  const part: WorkoutPart = { style: b.style };
  if (block.trim()) part.block = block.trim();
  if (def.fields.duration && Number(b.minutes)) part.durationMin = Number(b.minutes);
  if (def.fields.distance && Number(b.distance)) {
    part.distance = Number(b.distance);
    part.distanceUnit = b.distUnit;
  }
  const movements: WorkoutMovement[] = [];
  for (const m of b.moves) {
    const mv: WorkoutMovement = {};
    if (m.name.trim()) mv.name = m.name.trim();
    if (isSets(b.style)) {
      const filled = m.sets
        .filter((s) => Number(s.reps) || Number(s.weight))
        .map((s) => ({
          ...(Number(s.reps) ? { reps: Number(s.reps) } : {}),
          ...(Number(s.weight) ? { weight: Number(s.weight) } : {}),
        }));
      if (filled.length) {
        mv.sets = filled;
        if (filled.some((s) => s.weight)) mv.weightUnit = m.wtUnit;
      }
    } else if (isMetcon(b.style) && Number(m.reps)) {
      mv.reps = Number(m.reps);
    }
    if (Object.keys(mv).length) movements.push(mv);
  }
  if (movements.length) part.movements = movements;
  const hasData = part.durationMin || part.distance || part.movements;
  return hasData ? part : null;
};

function WorkoutCard() {
  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => [emptyBlock({ dist: "mi", wt: "lbs" })]);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<WorkoutLog["intensity"] | null>(null);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<WorkoutLog | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Backdate: empty = today; a picked YYYY-MM-DD logs against that day.
  const [logDay, setLogDay] = useState("");
  // Non-null while editing an existing log (button flips to "Update workout").
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = useDayKey();
  const day = logDay || today;
  const settings = useSettings();
  const distanceUnit = settings.distanceUnit ?? "mi";
  const weightUnit = settings.weightUnit ?? "lbs";
  const units: Units = { dist: distanceUnit, wt: weightUnit };

  const history = useLiveQuery(async () => {
    const all = await db.workoutLogs.toArray();
    // Order by the DAY the workout happened (backdated logs sort by their day,
    // not when they were saved); same-day ties fall back to save time.
    return all.sort((a, b) => (a.dayKey === b.dayKey ? b.ts - a.ts : a.dayKey < b.dayKey ? 1 : -1));
  }, []);
  /** Recents auto-expire: only logs from the last 14 days, max 5.
   *  dayKeys are ISO (YYYY-MM-DD) so string compare is date compare. */
  const recentCutoff = addDays(today, -14);
  const recent = history?.filter((w) => w.dayKey >= recentCutoff).slice(0, 5);
  // Session names autocomplete from your OWN past workout names only.
  const pastNames = [...new Set((history ?? []).map((w) => w.name))];
  // Movement names & block titles autocomplete from your history (+ the bundled
  // exercise vocabulary for movements).
  const allBlocks = (history ?? []).flatMap((w) => workoutBlocks(w));
  const pastMoves = [
    ...new Set(allBlocks.flatMap((b) => b.movements.map((m) => m.name).filter((n): n is string => !!n))),
  ];
  const moveSuggestions = [...pastMoves, ...EXERCISES.filter((e) => !pastMoves.includes(e))];
  const pastBlockTitles = [...new Set(allBlocks.map((b) => b.name).filter((n): n is string => !!n))];

  // Favorites are workout *names* (lowercased) stored in settings —
  // starring stars every past + future log with that name.
  const favorites = settings.favoriteWorkouts ?? [];
  const isFav = (n: string) => favorites.includes(n.trim().toLowerCase());
  const toggleFav = async (n: string) => {
    const key = n.trim().toLowerCase();
    if (!key) return;
    await saveSettings({
      favoriteWorkouts: isFav(n) ? favorites.filter((f) => f !== key) : [...favorites, key],
    });
  };
  /** Pinned favorites — the latest log per starred name, quick-load chips. */
  const pinned = favorites
    .map((key) => (history ?? []).find((w) => w.name.trim().toLowerCase() === key))
    .filter((w): w is WorkoutLog => !!w);
  // Favoriting only tags a workout — it still shows in recent (with a ★).
  const recentRows = recent ?? [];

  const effortOf = (w: WorkoutLog) => EFFORT.find((e) => e.v === w.intensity);

  /** Shared row renderer for pinned favorites + recent history. Name only —
   *  full detail (blocks, effort, note) lives in the click-through sheet. */
  const renderRow = (w: WorkoutLog) => (
    <div key={w.id} className="row-item">
      <button
        className="workout-row-btn"
        onClick={() => {
          setConfirmDelete(false);
          setDetail(w);
        }}
      >
        {isFav(w.name) ? "★ " : ""}
        {w.dayKey === today ? "▸ " : ""}
        {w.name}
      </button>
      <span className="off-day-tag">{w.dayKey}</span>
      <button
        className="btn ghost row-add"
        aria-label={`Load ${w.name} into the form`}
        title="Load this workout into the form"
        onClick={() => prefill(w)}
      >
        +
      </button>
    </div>
  );

  const reset = () => {
    setName("");
    setBlocks([emptyBlock(units)]);
    setRenameIdx(null);
    setIntensity(null);
    setNote("");
    setLogDay("");
    setEditingId(null);
    setError("");
  };

  /** Load a past session as a NEW log (no auto-submit — tweak, then log).
   *  Intensity + note + day are per-session results, entered fresh each time. */
  const prefill = (w: WorkoutLog) => {
    reset();
    setName(w.name);
    setBlocks(workoutBlocks(w).map((b) => blockToDraft(b, units)));
  };

  /** Edit THIS log in place — unlike prefill, its intensity/note/day come back
   *  so a fix (wrong day, submitted too soon) keeps what you already entered. */
  const startEdit = (w: WorkoutLog) => {
    setEditingId(w.id);
    setName(w.name);
    setBlocks(workoutBlocks(w).map((b) => blockToDraft(b, units)));
    setRenameIdx(null);
    setIntensity(w.intensity ?? null);
    setNote(w.note ?? "");
    setLogDay(w.dayKey);
    setConfirmDelete(false);
    setDetail(null);
  };

  // ---- block / movement editing ----
  const setBlock = (bi: number, patch: Partial<BlockDraft>) =>
    setBlocks(blocks.map((b, j) => (j === bi ? { ...b, ...patch } : b)));
  const setMove = (bi: number, mi: number, patch: Partial<MoveDraft>) =>
    setBlocks(
      blocks.map((b, j) =>
        j === bi ? { ...b, moves: b.moves.map((m, k) => (k === mi ? { ...m, ...patch } : m)) } : b,
      ),
    );
  const addMove = (bi: number) => setBlock(bi, { moves: [...blocks[bi].moves, emptyMove(units)] });
  const removeMove = (bi: number, mi: number) =>
    setBlock(bi, { moves: blocks[bi].moves.filter((_, k) => k !== mi) });
  const addBlock = () => {
    setBlocks([...blocks, emptyBlock(units, "sets")]);
    setRenameIdx(blocks.length); // open the new block's title for naming
  };
  const removeBlock = (bi: number) => {
    setBlocks(blocks.filter((_, j) => j !== bi));
    setRenameIdx(null);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Name your workout first — even “Quick session” works.");
      return;
    }
    // Multi-block logs always carry a block name so they regroup on reload; a
    // lone block stays untagged (clean + back-compatible with old logs).
    const multi = blocks.length > 1;
    const built = blocks
      .map((b, bi) => buildBlock(b, multi ? b.name.trim() || `Block ${bi + 1}` : b.name.trim()))
      .filter((p): p is WorkoutPart => !!p);
    const payload = {
      name,
      dayKey: day,
      ...(intensity ? { intensity } : {}),
      ...(built.length ? { parts: built } : {}),
      note,
    };
    if (editingId) await updateWorkout(editingId, payload);
    else await logWorkout(payload);
    reset();
  };

  return (
    <>
      {detail && (
        <InfoSheet
          title={detail.name}
          onClose={() => {
            setConfirmDelete(false);
            setDetail(null);
          }}
        >
          <p className="session-note detail-line">
            <span className="detail-label">Date:</span> {detail.dayKey}
          </p>
          <p className="session-note detail-line">
            <span className="detail-label">Workout Name:</span> {detail.name}
          </p>
          {workoutBlocks(detail).map((blk, bi) => {
            const styleLabel = WORKOUT_STYLES.find((s) => s.id === blk.style)?.label ?? blk.style;
            const blockRows: [string, string][] = [];
            if (blk.score) blockRows.push(["score", blk.score]);
            if (blk.durationMin) blockRows.push(["duration", `${blk.durationMin} min`]);
            if (blk.distance) blockRows.push(["distance", `${blk.distance} ${blk.distanceUnit ?? distanceUnit}`]);
            if (blk.note) blockRows.push(["note", blk.note]);
            return (
              <div className="block-detail" key={bi}>
                <p className="session-note detail-line">
                  <span className="detail-label">Block:</span> {blk.name || `Block ${bi + 1}`} · {styleLabel}
                </p>
                {blockRows.length > 0 && (
                  <table className="detail-table">
                    <tbody>
                      {blockRows.map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td colSpan={2}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {blk.movements.map((m, mi) => (
                  <div className="move-detail" key={mi}>
                    <p className="session-note detail-line">
                      <span className="detail-label">Movement:</span> {m.name || "—"}
                      {m.reps ? ` · ${m.reps} reps` : ""}
                    </p>
                    {m.sets?.length ? (
                      <table className="detail-table">
                        <tbody>
                          {m.sets.map((s, j) => (
                            <tr key={j}>
                              <td>set {j + 1}</td>
                              <td>{s.reps ?? "—"} reps</td>
                              <td>{s.weight ? `${s.weight} ${m.weightUnit ?? weightUnit}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })}
          {effortOf(detail) && (
            <p className="session-note detail-line">
              <span className="detail-label">Effort:</span> {effortOf(detail)!.glyph} {effortOf(detail)!.label}
            </p>
          )}
          {detail.note && (
            <p className="session-note detail-line">
              <span className="detail-label">Note:</span> {detail.note}
            </p>
          )}
          <div className="chip-row detail-actions">
            <button
              className={isFav(detail.name) ? "chip on" : "chip"}
              aria-pressed={isFav(detail.name)}
              onClick={() => toggleFav(detail.name)}
            >
              {isFav(detail.name) ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button className="chip" onClick={() => startEdit(detail)}>
              ✎ Edit this workout
            </button>
            <button className="chip" onClick={() => setConfirmDelete(true)}>
              ✕ Delete this log
            </button>
          </div>
          {confirmDelete && (
            <div className="chip-row">
              <button
                className="chip on"
                onClick={async () => {
                  await deleteWorkout(detail.id);
                  setConfirmDelete(false);
                  setDetail(null);
                }}
              >
                ⚠ Yes, delete this log
              </button>
              <button className="chip" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          )}
        </InfoSheet>
      )}

      {pinned.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Load Favorites</h2>
          </div>
          <div className="chip-row" role="group" aria-label="Favorite workouts">
            {pinned.map((w) => (
              <button key={w.id} className="chip" onClick={() => prefill(w)}>
                ★ {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Physical Training</h2>
        </div>
        <p className="placeholder">
          // write up a workout to continue your training regimen. check your recent workouts to add
          favorites. use your favorites to pre-fill workouts.
        </p>

        <div className="form-row name-date-row">
          <label className="date-field name-field">
            <span className="date-label">Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Tuesday workout"
              aria-label="Workout name"
              aria-invalid={!!error}
              list="past-workouts"
            />
            <datalist id="past-workouts">
              {pastNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label className="date-field date-col">
            <span className="date-label">Date</span>
            <input
              className="input"
              type="date"
              max={today}
              value={day}
              onChange={(e) => setLogDay(e.target.value)}
              aria-label="Workout date"
            />
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {day !== today && (
          <p className="placeholder">// backdating — this session lands on {day}, not today</p>
        )}
        <datalist id="past-moves">
          {moveSuggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <datalist id="past-block-titles">
          {pastBlockTitles.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        {blocks.map((b, bi) => {
          const def = WORKOUT_STYLES.find((s) => s.id === b.style)!;
          return (
            <div className="workout-block" key={bi}>
              <div className="form-row block-head">
                {renameIdx === bi ? (
                  <input
                    className="input block-title-input"
                    value={b.name}
                    autoFocus
                    onChange={(e) => setBlock(bi, { name: e.target.value })}
                    onBlur={() => setRenameIdx(null)}
                    onKeyDown={(e) => e.key === "Enter" && setRenameIdx(null)}
                    placeholder={`Block ${bi + 1} name`}
                    aria-label={`Block ${bi + 1} name`}
                    list="past-block-titles"
                  />
                ) : (
                  <>
                    <span className="block-title">{b.name || `Block ${bi + 1}`}</span>
                    <button
                      className="link-btn block-rename"
                      onClick={() => setRenameIdx(bi)}
                      aria-label={`Rename block ${bi + 1}`}
                      title="Rename block"
                    >
                      ✎
                    </button>
                  </>
                )}
                <select
                  className="input block-type"
                  value={b.style}
                  onChange={(e) => setBlock(bi, { style: e.target.value as WorkoutStyleId })}
                  aria-label={`Block ${bi + 1} type`}
                >
                  {WORKOUT_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {blocks.length > 1 && (
                  <button
                    className="link-btn danger block-remove"
                    onClick={() => removeBlock(bi)}
                    aria-label={`Remove block ${bi + 1}`}
                    title="Remove block"
                  >
                    ✕
                  </button>
                )}
              </div>

              {(def.fields.duration || def.fields.distance) && (
                <div className="form-row">
                  {def.fields.duration && (
                    <input
                      className="input num-input"
                      type="number"
                      min={1}
                      value={b.minutes}
                      onChange={(e) => setBlock(bi, { minutes: e.target.value })}
                      placeholder="min"
                      aria-label={`Block ${bi + 1} duration in minutes`}
                    />
                  )}
                  {def.fields.distance && (
                    <>
                      <input
                        className="input num-input"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        value={b.distance}
                        onChange={(e) => setBlock(bi, { distance: e.target.value })}
                        placeholder="distance"
                        aria-label={`Block ${bi + 1} distance`}
                      />
                      <select
                        className="input unit-mini"
                        value={b.distUnit}
                        onChange={(e) => setBlock(bi, { distUnit: e.target.value as DistUnit })}
                        aria-label={`Block ${bi + 1} distance unit`}
                      >
                        <option value="mi">mi</option>
                        <option value="km">km</option>
                      </select>
                    </>
                  )}
                </div>
              )}

              {b.moves.map((m, mi) => (
                  <div className="move-block" key={mi}>
                    <div className="form-row">
                      <input
                        className="input"
                        value={m.name}
                        onChange={(e) => setMove(bi, mi, { name: e.target.value })}
                        placeholder="Lift / movement — e.g. Back squats"
                        aria-label={`Block ${bi + 1} movement ${mi + 1} name`}
                        list="past-moves"
                      />
                      {isSets(b.style) && (
                        <select
                          className="input unit-mini"
                          value={m.sets.length}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setMove(bi, mi, {
                              sets: Array.from({ length: n }, (_, k) => m.sets[k] ?? { reps: "", weight: "" }),
                            });
                          }}
                          aria-label={`Block ${bi + 1} movement ${mi + 1} number of sets`}
                          title="Number of sets"
                        >
                          {SET_COUNTS.map((n) => (
                            <option key={n} value={n}>
                              {n} set{n === 1 ? "" : "s"}
                            </option>
                          ))}
                        </select>
                      )}
                      {isMetcon(b.style) && (
                        <input
                          className="input num-input"
                          type="number"
                          min={0}
                          value={m.reps}
                          onChange={(e) => setMove(bi, mi, { reps: e.target.value })}
                          placeholder="reps"
                          aria-label={`Block ${bi + 1} movement ${mi + 1} reps`}
                        />
                      )}
                      {b.moves.length > 1 && (
                        <button
                          className="btn ghost row-add set-remove"
                          onClick={() => removeMove(bi, mi)}
                          aria-label={`Remove movement ${mi + 1}`}
                          title="Remove this movement"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {isSets(b.style) && (
                      <div className="sets-grid" role="group" aria-label={`Block ${bi + 1} movement ${mi + 1} sets`}>
                        {m.sets.map((s, si) => (
                          <div className="form-row" key={si}>
                            <span className="off-day-tag set-num">set {si + 1}</span>
                            <input
                              className="input num-input"
                              type="number"
                              min={0}
                              value={s.reps}
                              onChange={(e) =>
                                setMove(bi, mi, {
                                  sets: m.sets.map((x, j) => (j === si ? { ...x, reps: e.target.value } : x)),
                                })
                              }
                              placeholder="reps"
                              aria-label={`Block ${bi + 1} movement ${mi + 1} set ${si + 1} reps`}
                            />
                            ×
                            <input
                              className="input num-input"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={s.weight}
                              onChange={(e) =>
                                setMove(bi, mi, {
                                  sets: m.sets.map((x, j) => (j === si ? { ...x, weight: e.target.value } : x)),
                                })
                              }
                              placeholder={m.wtUnit}
                              aria-label={`Block ${bi + 1} movement ${mi + 1} set ${si + 1} weight`}
                            />
                          </div>
                        ))}
                        <label className="unit-select">
                          <span className="date-label">weight in</span>
                          <select
                            className="input unit-mini"
                            value={m.wtUnit}
                            onChange={(e) => setMove(bi, mi, { wtUnit: e.target.value as WtUnit })}
                            aria-label={`Block ${bi + 1} movement ${mi + 1} weight unit`}
                          >
                            <option value="lbs">lbs</option>
                            <option value="kg">kg</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                ))}

              <button className="link-btn" onClick={() => addMove(bi)}>
                + add workout to this block
              </button>
            </div>
          );
        })}

        <button className="link-btn" onClick={addBlock}>
          + add block (mix cardio, lifting, conditioning in one)
        </button>

        <p className="section-note">// Did it hurt?</p>
        <div className="mood-row" role="group" aria-label="Workout intensity">
          {EFFORT.map((e) => (
            <button
              key={e.v}
              className={intensity === e.v ? "mood-btn on" : "mood-btn"}
              aria-pressed={intensity === e.v}
              aria-label={e.label}
              title={e.label}
              onClick={() => setIntensity(intensity === e.v ? null : e.v)}
            >
              <span className="mood-glyph" aria-hidden="true">
                {e.glyph}
              </span>
              <span className="mood-label">{e.label}</span>
            </button>
          ))}
        </div>

        <div className="form-row">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note — how it went #tags work"
            aria-label="Workout note"
          />
        </div>

        <button className="btn log-workout" onClick={submit}>
          {editingId ? "Update workout" : "Log workout"}
        </button>
        {editingId && (
          <button className="link-btn" onClick={reset}>
            cancel edit — start a fresh log
          </button>
        )}
      </div>

      {recentRows.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Workouts</h2>
          </div>
          {recentRows.map(renderRow)}
        </div>
      )}
    </>
  );
}

export function Training() {
  const today = useDayKey();
  return (
    <section aria-label="Training">
      <WorkoutGrid today={today} />
      <WorkoutCard />
    </section>
  );
}
