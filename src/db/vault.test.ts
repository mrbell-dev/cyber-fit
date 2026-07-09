import { describe, expect, it } from "vitest";
import { decryptVault, encryptVault, randomVaultId } from "./vault.ts";

describe("vault crypto", () => {
  it("round-trips", async () => {
    const blob = await encryptVault('{"app":"cyber-fit","secret":"the lizard"}', "correct horse");
    expect(await decryptVault(blob, "correct horse")).toContain("the lizard");
  });

  it("wrong passphrase throws (GCM auth), ciphertext hides plaintext", async () => {
    const blob = await encryptVault("weight 212.4 mood 3", "right");
    await expect(decryptVault(blob, "wrong")).rejects.toThrow();
    expect(atob(blob)).not.toContain("212.4");
  });

  it("same input twice → different blobs (fresh salt+iv)", async () => {
    const a = await encryptVault("x", "p");
    const b = await encryptVault("x", "p");
    expect(a).not.toBe(b);
  });

  it("stored-key blobs decrypt with the original passphrase (cross-device)", async () => {
    const { deriveStoredKey, encryptWithKey } = await import("./vault.ts");
    const { key, salt } = await deriveStoredKey("shared secret");
    const blob = await encryptWithKey("auto-sync payload", key, salt);
    expect(await decryptVault(blob, "shared secret")).toBe("auto-sync payload");
    await expect(decryptVault(blob, "other")).rejects.toThrow();
  });

  it("stored key decrypts blobs under its own salt, rejects re-keyed blobs", async () => {
    const { blobSalt, decryptWithKey, deriveStoredKey, encryptWithKey } = await import("./vault.ts");
    const foreign = await encryptVault("written elsewhere", "shared secret");
    // Derive the stored key from the existing blob's salt → it can read it.
    const { key, salt } = await deriveStoredKey("shared secret", blobSalt(foreign));
    expect(await decryptWithKey(foreign, key, salt)).toBe("written elsewhere");
    // Same salt, our own writes round-trip too.
    const own = await encryptWithKey("written here", key, salt);
    expect(await decryptWithKey(own, key, salt)).toBe("written here");
    // A blob under a fresh salt is unreadable by the stored key.
    const rekeyed = await encryptVault("new salt", "shared secret");
    await expect(decryptWithKey(rekeyed, key, salt)).rejects.toThrow(/re-keyed/);
  });

  it("vault ids are 32 hex chars", () => {
    expect(randomVaultId()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomVaultId()).not.toBe(randomVaultId());
  });
});
