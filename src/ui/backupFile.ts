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

/** Stored auto-sync credentials. Legacy records predate the flags and meant
 *  push-only, so absent flags default to push on / pull off. */
export interface VaultAuto {
  id: string;
  key: CryptoKey;
  salt: ArrayBuffer;
  push?: boolean;
  pull?: boolean;
}

export async function vaultAutoRecord(): Promise<VaultAuto | undefined> {
  const row = await db.kv.get("vaultAuto");
  const auto = row?.value as VaultAuto | undefined;
  return auto?.key ? { push: true, pull: false, ...auto } : undefined;
}

/** Auto vault sync: pull + MERGE first (so a second writer's rows land before
 *  we publish), then push the merged state, telling the relay which version we
 *  built on — a 409 means someone wrote in between, so pull-merge-push again.
 *  Merge never clears or overwrites local rows — see db/merge.ts — so a pull
 *  can't eat local data. Runs on app open, on visibility changes, and
 *  (debounced) after every local write. */
export async function autoVaultSync(): Promise<void> {
  if (syncRunning) {
    syncQueued = true;
    return;
  }
  syncRunning = true;
  try {
    const auto = await vaultAutoRecord();
    if (!auto) return;
    const { encryptWithKey, decryptWithKey } = await import("../db/vault.ts");
    const { relayConfig } = await import("./notify.ts");
    const relay = await relayConfig();
    if (!relay.url) return;
    const base = relay.url.replace(/\/$/, "");
    const salt = new Uint8Array(auto.salt);

    for (let attempt = 0; attempt < 3; attempt++) {
      let baseVersion: number | undefined;
      if (auto.pull) {
        const res = await fetch(`${base}/vault?id=${auto.id}`).catch(() => null);
        if (res?.ok) {
          const { blob, v } = await res.json();
          baseVersion = typeof v === "number" ? v : undefined;
          try {
            const { mergeJson } = await import("../db/merge.ts");
            await mergeJson(await decryptWithKey(blob, auto.key, salt));
          } catch {
            // Can't read the blob (re-keyed by another device, or corrupt).
            // Pushing now would overwrite data we never merged — bail out;
            // the manual "Pull from vault" with the passphrase recovers.
            return;
          }
        } else if (res?.status === 404) {
          baseVersion = 0;
        }
      }
      if (!auto.push) return;
      const blob = await encryptWithKey(await exportJson(), auto.key, salt);
      const pushRes = await fetch(`${base}/vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, blob, ...(baseVersion !== undefined ? { baseVersion } : {}) }),
      }).catch(() => null);
      if (pushRes?.status !== 409) return; // landed (or offline — next sync retries)
    }
  } catch {
    // sync is a bonus, never a blocker
  } finally {
    syncRunning = false;
    lastSyncTs = Date.now();
    if (syncQueued) {
      syncQueued = false;
      scheduleVaultSync();
    }
  }
}

let syncRunning = false;
let syncQueued = false;
let lastSyncTs = 0;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced sync — rapid-fire logging becomes one upload a few seconds after
 *  the last write. */
export function scheduleVaultSync(delayMs = 4000): void {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => autoVaultSync(), delayMs);
}

/** Tables whose writes should publish to the vault — mirrors db/merge.ts
 *  (kv and playerState are device-local / derived, so they don't count). */
const SYNC_TABLES = [
  "habits", "habitLogs", "waterLogs", "moodLogs", "workoutLogs",
  "readingItems", "readingLogs", "highlightLogs", "bodyLogs", "journalLogs",
  "gigs", "bioMetrics", "bioReadings", "screenings", "goals",
];

/** Wire live sync: every local write schedules a debounced sync (suppressed
 *  while a sync's own merge is writing), and visibility changes sync too —
 *  returning to the app catches up, leaving it publishes. Call once at boot. */
export function registerLiveSync(): void {
  for (const name of SYNC_TABLES) {
    const table = db.table(name);
    table.hook("creating", () => {
      if (!syncRunning) scheduleVaultSync();
    });
    table.hook("updating", () => {
      if (!syncRunning) scheduleVaultSync();
    });
    table.hook("deleting", () => {
      if (!syncRunning) scheduleVaultSync();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (Date.now() - lastSyncTs > 15_000) autoVaultSync();
    } else {
      // Best-effort publish on backgrounding — iOS may cut it short, and the
      // debounced push-on-write has usually landed already.
      autoVaultSync();
    }
  });
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
