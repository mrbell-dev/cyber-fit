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

/** Auto vault sync on app open: pull + MERGE first (so a second writer's rows
 *  land before we publish), then push the merged state. Merge never clears or
 *  overwrites local rows — see db/merge.ts — so a pull can't eat local data. */
export async function autoVaultSync(): Promise<void> {
  try {
    const auto = await vaultAutoRecord();
    if (!auto) return;
    const { encryptWithKey, decryptWithKey } = await import("../db/vault.ts");
    const { relayConfig } = await import("./notify.ts");
    const relay = await relayConfig();
    if (!relay.url) return;
    const base = relay.url.replace(/\/$/, "");
    const salt = new Uint8Array(auto.salt);

    if (auto.pull) {
      try {
        const res = await fetch(`${base}/vault?id=${auto.id}`);
        if (res.ok) {
          const { blob } = await res.json();
          const { mergeJson } = await import("../db/merge.ts");
          await mergeJson(await decryptWithKey(blob, auto.key, salt));
        }
      } catch {
        // salt re-keyed by another device, bad blob, or offline — the manual
        // "Pull from vault" with the passphrase is the recovery path
      }
    }

    if (auto.push) {
      const blob = await encryptWithKey(await exportJson(), auto.key, salt);
      await fetch(`${base}/vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto.id, blob }),
      });
    }
  } catch {
    // sync is a bonus, never a blocker
  }
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
