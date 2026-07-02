import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { PlayerState, Schedule } from "../../engine/index.ts";
import { addHabit, archiveHabit, deleteHabit, saveSettings } from "../../db/repo.ts";
import { downloadExport, exportJson, importJson } from "../../db/export.ts";
import { THEMES } from "../theme/themes.ts";
import { ReminderUplink } from "../components/ReminderUplink.tsx";
import { useSettings } from "../hooks.ts";

const REPO_URL = "https://github.com/michaelbell/cyber-fit"; // update after first push

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
        <a href={`${REPO_URL}#support`} target="_blank" rel="noreferrer">
          ◈ chip in $1 for server costs
        </a>
        <a href={`${REPO_URL}/wiki/Self-hosting-notifications`} target="_blank" rel="noreferrer">
          ⚙ self-host the notification relay
        </a>
      </div>
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

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function AddHabitForm() {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⚡");
  const [kind, setKind] = useState<Schedule["kind"]>("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [perWeek, setPerWeek] = useState(3);
  const [learning, setLearning] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    const schedule: Schedule =
      kind === "daily"
        ? { kind: "daily" }
        : kind === "weekdays"
          ? { kind: "weekdays", days }
          : { kind: "timesPerWeek", target: perWeek };
    await addHabit({ name, icon, schedule, domain: learning ? "learning" : "general" });
    setName("");
  };

  return (
    <div className="form-block">
      <div className="form-row">
        <input
          className="input icon-input"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          aria-label="Icon"
          maxLength={4}
        />
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New directive (e.g. Stretch 5 min)"
          aria-label="Habit name"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      <div className="form-row">
        <select
          className="input"
          value={kind}
          onChange={(e) => setKind(e.target.value as Schedule["kind"])}
          aria-label="Schedule"
        >
          <option value="daily">Every day</option>
          <option value="weekdays">Specific weekdays</option>
          <option value="timesPerWeek">N days a week (any days)</option>
        </select>
        <label className="check-label">
          <input type="checkbox" checked={learning} onChange={(e) => setLearning(e.target.checked)} />
          learning
        </label>
      </div>

      {kind === "weekdays" && (
        <div className="form-row weekday-row" role="group" aria-label="Days of week">
          {WEEKDAY_LABELS.map((label, i) => (
            <button
              key={i}
              className={days.includes(i) ? "day-toggle on" : "day-toggle"}
              aria-pressed={days.includes(i)}
              onClick={() =>
                setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort())
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {kind === "timesPerWeek" && (
        <div className="form-row">
          <label className="check-label">
            <input
              type="number"
              className="input num-input"
              min={1}
              max={7}
              value={perWeek}
              onChange={(e) => setPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
            />
            days per week — any days count
          </label>
        </div>
      )}

      <button className="btn" onClick={submit} disabled={!name.trim()}>
        Install directive
      </button>
    </div>
  );
}

export function System() {
  const settings = useSettings();
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archivedAt).sortBy("order"), []);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <section aria-label="System">
      <div className="card">
        <h2 className="card-title">Directives</h2>
        {(habits ?? []).map((h) => (
          <div className="row-item" key={h.id}>
            <span>
              {h.icon} {h.name}
              {h.domain === "learning" && <span className="off-day-tag"> · learning</span>}
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
        <AddHabitForm />
      </div>

      <div className="card">
        <h2 className="card-title">Config</h2>
        <label className="check-label">
          Daily water goal (ml)
          <input
            type="number"
            className="input num-input"
            min={250}
            step={250}
            value={settings.waterGoalMl}
            onChange={(e) => saveSettings({ waterGoalMl: Math.max(250, Number(e.target.value) || 2000) })}
          />
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
