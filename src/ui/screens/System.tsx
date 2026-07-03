import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { AREAS, AUGMENTS, mlToOz, ozToMl, PRESETS, type PlayerState } from "../../engine/index.ts";
import { archiveHabit, deleteHabit, saveSettings } from "../../db/repo.ts";
import { downloadExport, exportJson, importJson } from "../../db/export.ts";
import { THEMES } from "../theme/themes.ts";
import { ReminderUplink } from "../components/ReminderUplink.tsx";
import { HabitEditor, type EditorSeed } from "../components/HabitEditor.tsx";
import { useSettings } from "../hooks.ts";

const REPO_URL = "https://github.com/mrbell-dev/cyber-fit";

function areaIcon(id?: string): string {
  return AREAS.find((a) => a.id === id)?.icon ?? "";
}

function Directives() {
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archivedAt).sortBy("order"), []);
  const [seed, setSeed] = useState<EditorSeed | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const installedPresets = new Set((habits ?? []).map((h) => h.presetId).filter(Boolean));

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
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setSeed({})}>
          + New directive
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Directive Library</h2>
        <p className="placeholder">// defaults you can install, tweak, or ignore — nothing is mandatory</p>
        {(libraryOpen ? PRESETS : PRESETS.slice(0, 3)).map((p) => {
          const installed = installedPresets.has(p.presetId);
          return (
            <div className="row-item" key={p.presetId}>
              <span>
                {p.icon} {p.name}
                <span className="off-day-tag"> · {areaIcon(p.area)}</span>
              </span>
              {installed ? (
                <span className="off-day-tag">installed</span>
              ) : (
                <button
                  className="link-btn"
                  onClick={() =>
                    setSeed({
                      name: p.name,
                      icon: p.icon,
                      area: p.area,
                      schedule: p.schedule,
                      timeOfDay: p.timeOfDay,
                      reminderTime: p.suggestedReminder,
                      presetId: p.presetId,
                    })
                  }
                >
                  install
                </button>
              )}
            </div>
          );
        })}
        {PRESETS.length > 3 && (
          <button className="link-btn" onClick={() => setLibraryOpen(!libraryOpen)}>
            {libraryOpen ? "show less" : `… ${PRESETS.length - 3} more`}
          </button>
        )}
      </div>
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

function DataVault() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      {message && <p className="placeholder">// {message}</p>}
      <p className="placeholder">
        // your entire vault as one JSON file — move devices, keep your own backups
      </p>
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
        <p className="placeholder">
          // logs before the rollover hour count as the previous day — night owls stay safe
        </p>
      </div>

      <ReminderUplink />

      <Augments />

      <DataVault />

      <About />
    </section>
  );
}
