// Merge-import: union the vault into local data instead of replacing it.
// This is what makes pull-on-open safe next to a second writer (the phone
// stays authoritative for rows it already has; only genuinely new rows come
// in). Local wins on id conflict — a vault blob is usually built from an
// older snapshot of THIS device, so "vault wins" would revert local edits.
// Exception: gig completion/retirement set in the vault fills a local row
// that lacks it (checking off by text is an append-shaped fact, not an edit).
import { db } from "./db.ts";
import { refreshPlayer } from "./repo.ts";
import { EXPORT_VERSION } from "./export.ts";

/** Tables that merge by row id. kv is deliberately absent: it holds this
 *  device's private state (boot day, sync config) and must never sync. */
const MERGE_TABLES = [
  "habits",
  "habitLogs",
  "waterLogs",
  "moodLogs",
  "workoutLogs",
  "readingItems",
  "readingLogs",
  "highlightLogs",
  "bodyLogs",
  "journalLogs",
  "gigs",
  "gigTemplates",
  "bioMetrics",
  "bioReadings",
  "screenings",
  "goals",
  "goalLogs",
  "tombstones",
] as const;

type Row = { id: string } & Record<string, unknown>;

export interface MergePlan {
  adds: Partial<Record<(typeof MERGE_TABLES)[number], Row[]>>;
  gigPatches: { id: string; patch: Record<string, unknown> }[];
  /** Local rows a synced tombstone says were deleted elsewhere. */
  removes: { table: (typeof MERGE_TABLES)[number]; id: string }[];
}

/** Pure: decide what a vault file adds to the local tables. Throws the same
 *  readable errors as importJson when the file isn't a cyber-fit backup. */
export function planMerge(local: Record<string, Row[] | undefined>, file: unknown): MergePlan {
  const f = file as { app?: string; schemaVersion?: number; tables?: Record<string, unknown> };
  if (f?.app !== "cyber-fit" || typeof f.schemaVersion !== "number" || !f.tables) {
    throw new Error("Not a cyber-fit backup file.");
  }
  if (f.schemaVersion > EXPORT_VERSION) {
    throw new Error("Backup is from a newer app version — update the app first.");
  }

  const plan: MergePlan = { adds: {}, gigPatches: [], removes: [] };

  // Deletions beat union: a tombstone on either side means the row is dead.
  // Without this, deleting on the phone and then merging the vault (or vice
  // versa) resurrects the row from the older snapshot.
  const dead = new Set<string>();
  for (const t of local["tombstones"] ?? []) dead.add(t.id);
  const incomingTombs = f.tables["tombstones"];
  if (incomingTombs !== undefined && !Array.isArray(incomingTombs)) {
    throw new Error("Corrupt table: tombstones");
  }
  for (const t of (incomingTombs as Row[] | undefined) ?? []) {
    if (t.id) dead.add(t.id);
  }

  for (const name of MERGE_TABLES) {
    const incoming = f.tables[name];
    if (incoming === undefined) continue; // absent table (older schema) — leave local alone
    if (!Array.isArray(incoming)) throw new Error(`Corrupt table: ${name}`);
    const mine = new Map((local[name] ?? []).map((r) => [r.id, r]));
    const adds = (incoming as Row[]).filter(
      (r) => r.id && !mine.has(r.id) && (name === "tombstones" || !dead.has(r.id)),
    );
    if (adds.length) plan.adds[name] = adds;

    // A tombstone that arrived from the vault kills the matching local row.
    if (name !== "tombstones") {
      for (const r of local[name] ?? []) {
        if (dead.has(r.id)) plan.removes.push({ table: name, id: r.id });
      }
    }

    if (name === "gigs") {
      for (const r of incoming as Row[]) {
        const cur = mine.get(r.id);
        if (!cur) continue;
        const patch: Record<string, unknown> = {};
        if (r.doneTs && !cur.doneTs) {
          patch.doneTs = r.doneTs;
          patch.doneDay = r.doneDay;
        }
        if (r.retiredDay && !cur.retiredDay) patch.retiredDay = r.retiredDay;
        if (Object.keys(patch).length) plan.gigPatches.push({ id: r.id, patch });
      }
    }
  }
  return plan;
}

/** Apply a vault JSON string to the live db as a merge (never clears, never
 *  overwrites). Returns how many rows arrived. Rebuilds PlayerState when
 *  anything changed — merged logs are logs like any other. */
export async function mergeJson(raw: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }
  const local: Record<string, Row[]> = {};
  for (const name of MERGE_TABLES) local[name] = (await db.table(name).toArray()) as Row[];
  const plan = planMerge(local, parsed);

  const tables = Object.keys(plan.adds) as (keyof MergePlan["adds"])[];
  const added = tables.reduce((n, t) => n + (plan.adds[t]?.length ?? 0), 0);
  if (!added && !plan.gigPatches.length && !plan.removes.length) return 0;

  await db.transaction("rw", MERGE_TABLES.map((t) => db.table(t)), async () => {
    for (const t of tables) await db.table(t).bulkAdd(plan.adds[t]!);
    for (const { id, patch } of plan.gigPatches) await db.gigs.update(id, patch);
    for (const { table, id } of plan.removes) await db.table(table).delete(id);
  });
  await refreshPlayer();
  return added;
}
