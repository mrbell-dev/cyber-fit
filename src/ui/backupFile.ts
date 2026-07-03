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

/** Auto vault push: if the user enabled auto-sync, encrypt with the stored
 *  non-extractable key and push fresh ciphertext on every app open. */
export async function autoVaultPush(): Promise<void> {
  try {
    const row = await db.kv.get("vaultAuto");
    const auto = row?.value as { id: string; key: CryptoKey; salt: ArrayBuffer } | undefined;
    if (!auto?.key) return;
    const { encryptWithKey } = await import("../db/vault.ts");
    const { relayConfig } = await import("./notify.ts");
    const relay = await relayConfig();
    if (!relay.url) return;
    const blob = await encryptWithKey(await exportJson(), auto.key, new Uint8Array(auto.salt));
    await fetch(`${relay.url.replace(/\/$/, "")}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: auto.id, blob }),
    });
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
