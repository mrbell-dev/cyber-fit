import type { WorkoutLog, WorkoutMovement, WorkoutPart, WorkoutStyleId } from "./types.ts";

/** A workout's blocks (raw). New logs store `parts`; pre-`parts` logs are
 *  synthesized into one block from their flat fields so old history still
 *  renders. Always returns at least one block. */
export function workoutParts(w: WorkoutLog): WorkoutPart[] {
  if (w.parts?.length) return w.parts;
  const legacySets = w.exercises?.[0]?.sets;
  const part: WorkoutPart = {
    style: w.style ?? (legacySets?.length ? "sets" : "general"),
    ...(w.score ? { score: w.score } : {}),
    ...(w.durationMin ? { durationMin: w.durationMin } : {}),
    ...(w.distance ? { distance: w.distance } : {}),
    ...(legacySets?.length ? { sets: legacySets } : {}),
  };
  return [part];
}

/** The block model as the UI consumes it: a typed block owning any block-level
 *  result, with its movements listed. Handles three stored shapes — the current
 *  block model (`part.movements`), the interim movement-per-part-with-block-tag
 *  format, and pre-block movement-parts / legacy flat logs (each becomes its own
 *  block). Always returns at least one block. */
export interface WorkoutBlockView {
  name?: string;
  style: WorkoutStyleId;
  score?: string;
  durationMin?: number;
  distance?: number;
  distanceUnit?: "mi" | "km";
  note?: string;
  movements: WorkoutMovement[];
}

function blockShell(p: WorkoutPart): WorkoutBlockView {
  return {
    ...(p.block ? { name: p.block } : {}),
    style: p.style,
    ...(p.score ? { score: p.score } : {}),
    ...(p.durationMin ? { durationMin: p.durationMin } : {}),
    ...(p.distance ? { distance: p.distance } : {}),
    ...(p.distanceUnit ? { distanceUnit: p.distanceUnit } : {}),
    ...(p.note ? { note: p.note } : {}),
    movements: [],
  };
}

/** A pre-block movement-part → a single movement (name/sets only). */
function partToMovement(p: WorkoutPart): WorkoutMovement | null {
  const m: WorkoutMovement = {};
  if (p.name) m.name = p.name;
  if (p.sets?.length) m.sets = p.sets;
  if (p.weightUnit) m.weightUnit = p.weightUnit;
  return Object.keys(m).length ? m : null;
}

export function workoutBlocks(w: WorkoutLog): WorkoutBlockView[] {
  const parts = workoutParts(w);
  // Current block model: the part already carries its movements.
  if (parts.some((p) => p.movements)) {
    return parts.map((p) => ({ ...blockShell(p), movements: p.movements ?? [] }));
  }
  // Interim format: movement-per-part carrying a block tag — regroup by tag.
  if (parts.some((p) => p.block)) {
    const out: WorkoutBlockView[] = [];
    for (const p of parts) {
      const bn = p.block ?? "";
      const last = out[out.length - 1];
      const mv = partToMovement(p);
      if (last && (last.name ?? "") === bn) {
        if (mv) last.movements.push(mv);
      } else {
        const blk = blockShell(p);
        if (mv) blk.movements.push(mv);
        out.push(blk);
      }
    }
    return out;
  }
  // Pre-block movement-parts (and the legacy-flat synth): one block each.
  return parts.map((p) => {
    const blk = blockShell(p);
    const mv = partToMovement(p);
    if (mv) blk.movements.push(mv);
    return blk;
  });
}
