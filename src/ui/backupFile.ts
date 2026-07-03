// Linked backup file (File System Access API, Chrome/Edge): the user picks a
// file — ideally inside a folder that Drive/Syncthing/Nextcloud already syncs —
// and we rewrite it with a fresh export on every app open. Cross-device backup
// with zero OAuth and zero new servers. Silently absent elsewhere.
import { db } from "../db/db.ts";
import { exportJson } from "../db/export.ts";

interface FileHandleish {
  queryPermission?: (o: { mode: string }) => Promise<string>;
  requestPermission?: (o: { mode: string }) => Promise<string>;
  createWritable: () => Promise<{ write: (s: string) => Promise<void>; close: () => Promise<void> }>;
}

export async function writeLinkedBackup(): Promise<void> {
  try {
    const row = await db.kv.get("backupHandle");
    const handle = row?.value as FileHandleish | undefined;
    if (!handle?.createWritable) return;
    if (handle.queryPermission && (await handle.queryPermission({ mode: "readwrite" })) !== "granted") {
      // Don't prompt on open — permission re-asks only from a user gesture.
      return;
    }
    const w = await handle.createWritable();
    await w.write(await exportJson());
    await w.close();
  } catch {
    // never let backup plumbing break the app
  }
}
