// Encrypted vault sync — account-free cross-device sync. Everything here runs
// ON-DEVICE: passphrase → PBKDF2(210k, SHA-256) → AES-256-GCM. The relay only
// ever sees ciphertext under a random 128-bit id. Wrong passphrase = garbage;
// there is no recovery, and that's the point.

const ITERATIONS = 210_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function randomVaultId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** plaintext + key + salt → base64(salt ‖ iv ‖ ciphertext). The salt rides
 *  along so the other device can re-derive the key from the passphrase. */
export async function encryptWithKey(plaintext: string, key: CryptoKey, salt: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(plaintext)),
  );
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ct, salt.length + iv.length);
  return toB64(out);
}

/** plaintext + passphrase → base64(salt ‖ iv ‖ ciphertext) */
export async function encryptVault(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return encryptWithKey(plaintext, await deriveKey(passphrase, salt), salt);
}

/** For auto-sync: derive once, keep the NON-EXTRACTABLE key + salt on-device
 *  so every app open can push fresh ciphertext without re-entering the
 *  passphrase. The key can encrypt but never be exported — and the local
 *  data it protects is already plaintext on this device, so this stores
 *  nothing more sensitive than what's already here. */
export async function deriveStoredKey(
  passphrase: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  return { key: await deriveKey(passphrase, salt), salt };
}

/** The salt a blob was encrypted under. Deriving the stored key from the
 *  CURRENT vault blob's salt (instead of a fresh one) is what lets auto-pull
 *  keep decrypting blobs written by other clients that re-use the salt they
 *  read (the trainer does). */
export function blobSalt(blob: string): Uint8Array {
  return fromB64(blob).slice(0, 16);
}

/** Decrypt with the stored non-extractable key. Throws when the blob was
 *  encrypted under a different salt (the key can't apply) or fails GCM auth. */
export async function decryptWithKey(blob: string, key: CryptoKey, salt: Uint8Array): Promise<string> {
  const bytes = fromB64(blob);
  if (bytes.slice(0, 16).some((b, i) => b !== salt[i])) {
    throw new Error("Vault was re-keyed by another device — pull once with the passphrase.");
  }
  const iv = bytes.slice(16, 28);
  const ct = bytes.slice(28);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}

/** Throws on wrong passphrase or corrupt blob (GCM authenticates). */
export async function decryptVault(blob: string, passphrase: string): Promise<string> {
  const bytes = fromB64(blob);
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ct = bytes.slice(28);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}
