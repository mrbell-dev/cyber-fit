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

  it("vault ids are 32 hex chars", () => {
    expect(randomVaultId()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomVaultId()).not.toBe(randomVaultId());
  });
});
