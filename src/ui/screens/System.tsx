import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { AREAS, AUGMENTS, mlToOz, ozToMl, type PlayerState } from "../../engine/index.ts";
import { archiveHabit, deleteHabit, saveSettings } from "../../db/repo.ts";
import { downloadExport, exportJson, importJson } from "../../db/export.ts";
import { decryptVault, encryptVault, randomVaultId } from "../../db/vault.ts";
import { relayConfig } from "../notify.ts";
import { writeLinkedBackup } from "../backupFile.ts";
import { THEMES } from "../theme/themes.ts";
import { ReminderUplink } from "../components/ReminderUplink.tsx";
import { HabitEditor, type EditorSeed } from "../components/HabitEditor.tsx";
import { DirectiveCodex } from "../components/DirectiveCodex.tsx";
import { FieldManual } from "../components/FieldManual.tsx";
import { DevPanel } from "../components/DevPanel.tsx";
import { useSettings } from "../hooks.ts";

const REPO_URL = "https://github.com/mrbell-dev/cyber-fit";

function areaIcon(id?: string): string {
  return AREAS.find((a) => a.id === id)?.icon ?? "";
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
                {h.area ? ` · ${areaIcon(h.area)}` : ""}
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
            Open codex
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
      <div className="theme-row">
        {THEMES.map((t) => {
          const isUnlocked = t.augment === null || unlocked.has(t.augment);
          const active = settings.activeTheme === t.id;
          return (
            <button
              key={t.id}
              className={`theme-swatch${active ? " on" : ""}${isUnlocked ? "" : " locked"}`}
              disabled={!isUnlocked}
              aria-pressed={active}
              title={isUnlocked ? t.name : `${t.name} — locked (level up or find a data shard)`}
              onClick={() => saveSettings({ activeTheme: t.id })}
            >
              {isUnlocked ? t.name : `🔒 ${t.name}`}
            </button>
          );
        })}
      </div>
      <p className="placeholder">
        // themes are pluggable CSS packs — a medieval or minimal pack is one PR away
      </p>

      <h3 className="card-title" style={{ marginTop: 14 }}>
        FX Modules
      </h3>
      <div className="theme-row">
        {AUGMENTS.filter((a) => a.kind === "fx").map((a) => {
          const isUnlocked = unlocked.has(a.id);
          const on = (settings.activeFx ?? []).includes(a.id);
          return (
            <button
              key={a.id}
              className={`theme-swatch${on ? " on" : ""}${isUnlocked ? "" : " locked"}`}
              disabled={!isUnlocked}
              aria-pressed={on}
              title={isUnlocked ? a.desc : `${a.name} — shard-drop only`}
              onClick={() =>
                saveSettings({
                  activeFx: on
                    ? (settings.activeFx ?? []).filter((id) => id !== a.id)
                    : [...(settings.activeFx ?? []), a.id],
                })
              }
            >
              {isUnlocked ? a.name : `🔒 ${a.name}`}
            </button>
          );
        })}
      </div>
      <p className="placeholder">// motion fx auto-disable if your OS asks for reduced motion</p>

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

  const push = async () => {
    const relay = await relayConfig();
    if (!relay.url) return setMsg("no relay configured");
    const id = sync?.id ?? randomVaultId();
    const blob = await encryptVault(await exportJson(), pass);
    const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, blob }),
    }).catch(() => null);
    if (!res?.ok) return setMsg("relay unreachable — try again later");
    await db.kv.put({ key: "vaultSync", value: { id, lastPush: Date.now() } });
    setMsg(`pushed. vault id: ${id} — enter it + your passphrase on the other device`);
  };

  const pull = async () => {
    const relay = await relayConfig();
    const id = (pullId || sync?.id || "").trim();
    if (!relay.url || !/^[0-9a-f]{32}$/.test(id)) return setMsg("need a valid 32-char vault id");
    const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault?id=${id}`).catch(() => null);
    if (!res?.ok) return setMsg("vault not found on relay");
    try {
      const { blob } = await res.json();
      await importJson(await decryptVault(blob, pass));
      await db.kv.put({ key: "vaultSync", value: { id, lastPush: Date.now() } });
      setMsg("pulled + decrypted — everything restored");
    } catch {
      setMsg("decryption failed — wrong passphrase (no recovery exists, by design)");
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

      {settings.devMode && <DevPanel />}

      <ReminderUplink />

      <Augments />

      <DataVault />

      <FieldManual />

      <About />
    </section>
  );
}
