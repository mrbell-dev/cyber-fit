import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { AREAS, AUGMENTS, mlToOz, ozToMl, type PlayerState } from "../../engine/index.ts";
import { archiveHabit, deleteHabit, saveSettings, setLayout } from "../../db/repo.ts";
import { downloadExport, exportJson, importJson } from "../../db/export.ts";
import { mergeJson } from "../../db/merge.ts";
import { blobSalt, decryptVault, deriveStoredKey, encryptVault, randomVaultId } from "../../db/vault.ts";
import { relayConfig } from "../notify.ts";
import { defaultLayout } from "../layout.ts";
import { autoVaultSync, vaultAutoRecord, writeLinkedBackup } from "../backupFile.ts";
import { THEMES } from "../theme/themes.ts";
import { ReminderUplink } from "../components/ReminderUplink.tsx";
import { HabitEditor, type EditorSeed } from "../components/HabitEditor.tsx";
import { DirectiveCodex } from "../components/DirectiveCodex.tsx";
import { FieldManual } from "../components/FieldManual.tsx";
import { NavLayoutEditor } from "../components/NavLayoutEditor.tsx";
import { DevPanel } from "../components/DevPanel.tsx";
import { AccessCodeField } from "../components/AccessCodeField.tsx";
import { useSettings } from "../hooks.ts";

const REPO_URL = "https://github.com/mrbell-dev/cyber-fit";

function areaLabel(id?: string): string {
  const a = AREAS.find((a) => a.id === id);
  return a ? `${a.icon} ${a.name}` : "";
}

function Directives() {
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archivedAt).sortBy("order"), []);
  const [seed, setSeed] = useState<EditorSeed | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);

  return (
    <>
      {seed && <HabitEditor seed={seed} onClose={() => setSeed(null)} />}

      <div className="card">
        <h2 className="card-title">Directives</h2>
        {(habits ?? []).map((h) => (
          <div className="row-item" key={h.id}>
            <span>
              {h.icon} {h.name}
              <span className="off-day-tag">
                {h.area ? ` · ${areaLabel(h.area)}` : ""}
                {h.reminderTime ? ` · 🔔${h.reminderTime}` : ""}
                {h.pings ? ` · 🔔×${h.pings.times}` : ""}
              </span>
            </span>
            <span className="row-actions">
              {confirmDelete === h.id ? (
                <>
                  <button className="link-btn danger" onClick={() => deleteHabit(h.id)}>
                    confirm delete
                  </button>
                  <button className="link-btn" onClick={() => setConfirmDelete(null)}>
                    keep
                  </button>
                </>
              ) : (
                <>
                  <button className="link-btn" onClick={() => setSeed({ habit: h })}>
                    edit
                  </button>
                  <button className="link-btn" onClick={() => archiveHabit(h.id)}>
                    archive
                  </button>
                  <button className="link-btn danger" onClick={() => setConfirmDelete(h.id)}>
                    delete
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        <div className="form-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => setSeed({})}>
            + New directive
          </button>
          <button className="btn ghost" onClick={() => setCodexOpen(true)}>
            Open codex — preset directives
          </button>
        </div>
      </div>

      {codexOpen && (
        <DirectiveCodex
          onSeed={(s) => {
            setCodexOpen(false);
            setSeed(s);
          }}
          onClose={() => setCodexOpen(false)}
        />
      )}
    </>
  );
}

function Augments() {
  const settings = useSettings();
  const player = useLiveQuery(
    async () => (await db.kv.get("player"))?.value as PlayerState | undefined,
    [],
  );
  const unlocked = new Set(player?.unlockedAugments ?? []);

  return (
    <div className="card">
      <h2 className="card-title">Augments — Visual Cortex</h2>
      <div className="preview-grid">
        {THEMES.map((t) => {
          const isUnlocked = t.augment === null || unlocked.has(t.augment);
          const active = settings.activeTheme === t.id;
          return (
            <button
              key={t.id}
              className={`preview-tile${active ? " on" : ""}${isUnlocked ? "" : " locked"}`}
              disabled={!isUnlocked}
              aria-pressed={active}
              onClick={() => saveSettings({ activeTheme: t.id })}
            >
              <span className="swatch-strip" aria-hidden="true">
                {t.swatch.map((c, i) => (
                  <span key={i} className="swatch-dot" style={{ background: c }} />
                ))}
              </span>
              <span className="preview-name">
                {isUnlocked ? t.name : `🔒 ${t.name}`}
                {active && <span className="preview-tag"> · active</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="placeholder">
        // swatches are the real palette. locked packs still preview — level up
        or find a data shard to install. new packs are one PR away
      </p>

      <h3 className="card-title" style={{ marginTop: 14 }}>
        FX Modules
      </h3>
      <div className="preview-grid">
        {AUGMENTS.filter((a) => a.kind === "fx").map((a) => {
          const isUnlocked = unlocked.has(a.id);
          const on = (settings.activeFx ?? []).includes(a.id);
          const previewKind =
            a.id === "fx-scanlines" ? "scanlines" : a.id === "fx-glitch-title" ? "glitch" : "crt";
          return (
            <button
              key={a.id}
              className={`preview-tile${on ? " on" : ""}${isUnlocked ? "" : " locked"}`}
              disabled={!isUnlocked}
              aria-pressed={on}
              title={a.desc}
              onClick={() =>
                saveSettings({
                  activeFx: on
                    ? (settings.activeFx ?? []).filter((id) => id !== a.id)
                    : [...(settings.activeFx ?? []), a.id],
                })
              }
            >
              <span className={`fx-preview ${previewKind}`} aria-hidden="true" />
              <span className="preview-name">
                {isUnlocked ? a.name : `🔒 ${a.name}`}
                {on && <span className="preview-tag"> · on</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="placeholder">// tiles show the live effect · motion auto-disables if your OS asks for reduced motion</p>

      <h3 className="card-title" style={{ marginTop: 14 }}>
        Catalog
      </h3>
      {AUGMENTS.map((a) => (
        <div className="row-item" key={a.id}>
          <span>
            {unlocked.has(a.id) ? "◈" : "🔒"} {a.name}
            <span className="off-day-tag"> · {a.desc}</span>
          </span>
          <span className="off-day-tag">
            {unlocked.has(a.id) ? "installed" : a.level !== undefined ? `LVL ${a.level}` : "shard drop"}
          </span>
        </div>
      ))}
    </div>
  );
}

function VaultSync() {
  const [pass, setPass] = useState("");
  const [pullId, setPullId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const sync = useLiveQuery(
    async () => (await db.kv.get("vaultSync"))?.value as { id: string } | undefined,
    [],
  );
  const auto = useLiveQuery(vaultAutoRecord, []);

  const hdr = (relay: { code: string }): Record<string, string> => (relay.code ? { "x-cf-access": relay.code } : {});

  /** Flip one auto-sync direction. First enable derives + stores the key —
   *  from the CURRENT blob's salt when one exists, so the stored key can read
   *  blobs other clients wrote by re-using that salt (the trainer does). */
  const toggleAuto = async (flag: "push" | "pull", on: boolean) => {
    if (auto) {
      const next = { ...auto, [flag]: on };
      if (!next.push && !next.pull) {
        await db.kv.delete("vaultAuto");
        return setMsg("auto-sync off — manual push/pull still work");
      }
      await db.kv.put({ key: "vaultAuto", value: next });
      if (flag === "pull" && on) await autoVaultSync();
      return setMsg(`auto ${flag} ${on ? "on" : "off"}`);
    }
    if (!on) return;
    if (pass.length < 8) return setMsg("enter your passphrase first to enable auto-sync");
    const relay = await relayConfig();
    if (!relay.url) return setMsg("no relay configured");
    const id = sync?.id ?? randomVaultId();
    const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault?id=${id}`, { headers: hdr(relay) }).catch(() => null);
    let salt: Uint8Array | undefined;
    if (res?.ok) {
      const { blob } = await res.json();
      try {
        await decryptVault(blob, pass); // verify before trusting the passphrase for auto mode
      } catch {
        return setMsg("that passphrase doesn't open the existing vault — not enabling auto-sync");
      }
      salt = blobSalt(blob);
    }
    const derived = await deriveStoredKey(pass, salt);
    await db.kv.put({
      key: "vaultAuto",
      value: { id, key: derived.key, salt: derived.salt.buffer, push: flag === "push", pull: flag === "pull" },
    });
    await db.kv.put({ key: "vaultSync", value: { id, lastPush: Date.now() } });
    await autoVaultSync();
    setMsg(`auto ${flag} on — runs on every app open. vault id: ${id}`);
  };

  const push = async () => {
    const relay = await relayConfig();
    if (!relay.url) return setMsg("no relay configured");
    const id = sync?.id ?? randomVaultId();
    const blob = await encryptVault(await exportJson(), pass);
    const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hdr(relay) },
      body: JSON.stringify({ id, blob }),
    }).catch(() => null);
    if (res?.status === 401) return setMsg("ACCESS DENIED — bad access code (enter the beta code above)");
    if (!res?.ok) return setMsg("relay unreachable — try again later");
    await db.kv.put({ key: "vaultSync", value: { id, lastPush: Date.now() } });
    setMsg(`pushed. vault id: ${id} — enter it + your passphrase on the other device`);
  };

  const pull = async () => {
    const relay = await relayConfig();
    const id = (pullId || sync?.id || "").trim();
    if (!relay.url || !/^[0-9a-f]{32}$/.test(id)) return setMsg("need a valid 32-char vault id");
    const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault?id=${id}`, { headers: hdr(relay) }).catch(() => null);
    if (res?.status === 401) return setMsg("ACCESS DENIED — bad access code (enter the beta code above)");
    if (!res?.ok) return setMsg("vault not found on relay");
    let json: string;
    try {
      const { blob } = await res.json();
      json = await decryptVault(blob, pass);
    } catch {
      // Only the crypto layer means a bad passphrase — everything after this
      // point is plaintext, so its failures must NOT be blamed on the user.
      return setMsg("decryption failed — wrong passphrase (no recovery exists, by design)");
    }
    try {
      // Empty device → full restore. Anything local → compare-and-merge, so a
      // pull can never eat data logged here since the vault was written.
      const hasLocal = (await db.habits.count()) + (await db.gigs.count()) + (await db.waterLogs.count()) > 0;
      if (hasLocal) {
        const added = await mergeJson(json);
        setMsg(added ? `merged — ${added} new row${added === 1 ? "" : "s"} from the vault` : "merged — nothing new in the vault");
      } else {
        await importJson(json);
        setMsg("pulled + decrypted — everything restored");
      }
      await db.kv.put({ key: "vaultSync", value: { id, lastPush: Date.now() } });
    } catch (e) {
      // e.g. "Backup is from a newer app version — update the app first."
      setMsg(e instanceof Error ? e.message.toLowerCase() : "vault contents couldn't be applied");
    }
  };

  return (
    <>
      <h3 className="card-title" style={{ marginTop: 14 }}>
        Vault Sync — encrypted, no accounts
      </h3>
      <p className="placeholder">
        // your vault is AES-encrypted ON THIS DEVICE with your passphrase before
        upload. the relay stores unreadable ciphertext under a random id. lose the
        passphrase, lose the vault — nobody can reset it, including us
      </p>
      <p className="placeholder">// closed beta: the shared relay needs an access code</p>
      <AccessCodeField />
      <div className="form-row">
        <input
          className="input"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="sync passphrase (make it long)"
          aria-label="Vault passphrase"
        />
      </div>
      <div className="form-row">
        <button className="btn" onClick={push} disabled={pass.length < 8}>
          Push to vault
        </button>
        <button className="btn ghost" onClick={pull} disabled={pass.length < 8}>
          Pull from vault
        </button>
      </div>
      <input
        className="input"
        value={pullId}
        onChange={(e) => setPullId(e.target.value)}
        placeholder={sync?.id ? `vault id: ${sync.id}` : "vault id (from your other device)"}
        aria-label="Vault id"
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={auto?.push ?? false}
          onChange={(e) => toggleAuto("push", e.target.checked)}
        />
        auto-push on every app open
        <span className="off-day-tag">
          keeps a non-exportable key on this device — the relay still sees only ciphertext
        </span>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={auto?.pull ?? false}
          onChange={(e) => toggleAuto("pull", e.target.checked)}
        />
        pull + merge on every app open
        <span className="off-day-tag">
          compare-and-merge, never replace — new rows from other writers land, local data always wins
        </span>
      </label>
      {msg && <p className="placeholder">// {msg}</p>}
    </>
  );
}

function DataVault() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);

  const linkBackup = async () => {
    const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<unknown> })
      .showSaveFilePicker;
    if (!picker) return setMessage("file linking needs Chrome/Edge — use export or vault sync instead");
    try {
      const handle = await picker({
        suggestedName: "cyber-fit-backup.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      await db.kv.put({ key: "backupHandle", value: handle });
      setLinked(true);
      setMessage("linked — the backup rewrites itself on every app open. park it in any synced folder");
      await writeLinkedBackup();
    } catch {
      // picker dismissed
    }
  };

  const doExport = async () => {
    downloadExport(await exportJson());
    setMessage("Backup exported.");
  };

  const doImport = async (file: File) => {
    try {
      await importJson(await file.text());
      setMessage("Backup restored — player state rebuilt from logs.");
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Data Vault</h2>
      <div className="form-row">
        <button className="btn" onClick={doExport}>
          Export backup
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          aria-label="Import backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </div>
      <button className="link-btn" onClick={linkBackup}>
        {linked ? "backup file linked ✓" : "link a backup file (auto-rewrites on open)"}
      </button>
      {message && <p className="placeholder">// {message}</p>}
      <p className="placeholder">
        // your entire vault as one JSON file — move devices, keep your own backups
      </p>

      <VaultSync />
    </div>
  );
}

function About() {
  return (
    <div className="card">
      <h2 className="card-title">About</h2>
      <p className="lore">
        <strong>Stay grounded. Avoid cyberpsychosis.</strong> Too many augments and not enough
        humanity is a known failure mode — this app is the counter-protocol: daily syncs with
        your body and brain, tracked on your own hardware.
      </p>
      <p>
        Free forever, open source (MIT), zero tracking. Everything you log lives on this device —
        no accounts, no analytics, no server holding your data.
      </p>
      <div className="about-links">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          ⌥ contribute on GitHub
        </a>
        <a href="https://buymeacoffee.com/mrbell.dev" target="_blank" rel="noreferrer">
          ◈ buy me a coffee — keeps the relay lit
        </a>
        <a href={`${REPO_URL}/blob/main/SELF-HOSTING.md`} target="_blank" rel="noreferrer">
          ⚙ self-host the notification relay
        </a>
      </div>
    </div>
  );
}

export function System() {
  const settings = useSettings();
  const [resetArmed, setResetArmed] = useState(false);

  return (
    <section aria-label="System">
      <Directives />

      <div className="card">
        <h2 className="card-title">Config</h2>
        <label className="check-label">
          Daily water goal
          <input
            type="number"
            className="input num-input"
            min={settings.waterUnit === "oz" ? 8 : 250}
            step={settings.waterUnit === "oz" ? 8 : 250}
            value={settings.waterUnit === "oz" ? mlToOz(settings.waterGoalMl) : settings.waterGoalMl}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              const ml = settings.waterUnit === "oz" ? ozToMl(v) : v;
              saveSettings({ waterGoalMl: Math.max(237, ml || 2000) });
            }}
            aria-label="Daily water goal"
          />
          <select
            className="input"
            value={settings.waterUnit ?? "ml"}
            onChange={(e) => saveSettings({ waterUnit: e.target.value as "ml" | "oz" })}
            aria-label="Water unit"
          >
            <option value="ml">ml</option>
            <option value="oz">oz</option>
          </select>
        </label>
        <label className="check-label">
          Difficulty
          <select
            className="input"
            value={settings.difficulty ?? "standard"}
            onChange={(e) => saveSettings({ difficulty: e.target.value as "easy" | "standard" | "hard" })}
            aria-label="Difficulty"
          >
            <option value="easy">Easy — gentler level curve</option>
            <option value="standard">Standard</option>
            <option value="hard">Hard — full merc mode</option>
          </select>
        </label>
        <label className="check-label">
          Day rolls over at
          <select
            className="input"
            value={settings.dayStartHour}
            onChange={(e) => saveSettings({ dayStartHour: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>
                {h}:00 AM
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          Units
          <select
            className="input"
            value={settings.weightUnit ?? "lbs"}
            onChange={(e) => saveSettings({ weightUnit: e.target.value as "lbs" | "kg" })}
            aria-label="Weight unit"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
          <select
            className="input"
            value={settings.distanceUnit ?? "mi"}
            onChange={(e) => saveSettings({ distanceUnit: e.target.value as "mi" | "km" })}
            aria-label="Distance unit"
          >
            <option value="mi">miles</option>
            <option value="km">km</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={settings.devMode ?? false}
            onChange={(e) => saveSettings({ devMode: e.target.checked })}
          />
          Dev mode — test bench for pings, toasts, popups
        </label>
        <p className="placeholder">
          // logs before the rollover hour count as the previous day — night owls stay safe
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Layout</h2>
        <p className="dim">Rebuilds the stock dashboard and nav. Custom pages' layouts are discarded — your logged data is untouched.</p>
        {resetArmed ? (
          <div role="group" aria-label="Confirm layout reset">
            <button style={{ minHeight: 48 }}
              onClick={async () => { await setLayout(defaultLayout()); setResetArmed(false); }}>
              Confirm reset
            </button>
            <button style={{ minHeight: 48 }} onClick={() => setResetArmed(false)}>Cancel</button>
          </div>
        ) : (
          <button style={{ minHeight: 48 }} onClick={() => setResetArmed(true)}>
            Reset layout to default
          </button>
        )}
      </div>

      {settings.devMode && <DevPanel />}

      <ReminderUplink />

      <NavLayoutEditor />

      <Augments />

      <DataVault />

      <FieldManual />

      <About />
    </section>
  );
}
