// Local JSON backup: export everything, import validates then replaces, and
// PlayerState is rebuilt from the imported logs (never trusted from the file).
import { db } from "./db.ts";
import { refreshPlayer } from "./repo.ts";

export const EXPORT_VERSION = 10;

const TABLES = [
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
  "bioMetrics",
  "bioReadings",
  "screenings",
  "goals",
  "goalLogs",
  "tombstones",
  "kv",
] as const;

type TableName = (typeof TABLES)[number];

export interface ExportFile {
  app: "cyber-fit";
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export async function exportJson(): Promise<string> {
  const tables = {} as ExportFile["tables"];
  for (const name of TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  const file: ExportFile = {
    app: "cyber-fit",
    schemaVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
  return JSON.stringify(file, null, 2);
}

export function downloadExport(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cyber-fit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Throws with a readable message when the file isn't a cyber-fit backup. */
export async function importJson(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }
  const file = parsed as Partial<ExportFile>;
  if (file.app !== "cyber-fit" || typeof file.schemaVersion !== "number" || !file.tables) {
    throw new Error("Not a cyber-fit backup file.");
  }
  if (file.schemaVersion > EXPORT_VERSION) {
    throw new Error("Backup is from a newer app version — update the app first.");
  }
  for (const name of TABLES) {
    const rows = file.tables[name];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Corrupt table: ${name}`);
  }

  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear();
      const rows = file.tables![name];
      if (rows?.length) await db.table(name).bulkAdd(rows);
    }
  });
  // Snapshot is derived state — always rebuild it from the imported logs.
  await refreshPlayer();
}
