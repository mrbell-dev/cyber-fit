import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { DEFAULT_REMINDERS, type Reminders } from "../../engine/index.ts";
import { saveSettings, setBioMetricPings, updateHabit } from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";
import { disablePush, enablePush, pushActive, saveReminders, syncPush, testPush } from "../notify.ts";
import { InfoSheet } from "./InfoSheet.tsx";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const SYSTEM_PINGS: { key: keyof Reminders & ("morning" | "water" | "workout" | "highlight" | "motivation" | "catchup"); label: string }[] = [
  { key: "morning", label: "Morning boot" },
  { key: "water", label: "Hydration" },
  { key: "workout", label: "Training" },
  { key: "highlight", label: "Highlight nudge" },
  { key: "motivation", label: "Motivation" },
  { key: "catchup", label: "Log catch-up" },
];

/** One list of every ping that can fire — system, per-directive, per-metric —
 *  classified and each toggleable. Turning a directive/metric ping off clears
 *  it (re-enable in its own editor). */
function NotificationInventory({
  reminders,
  update,
  onClose,
}: {
  reminders: Reminders;
  update: (patch: Partial<Reminders>) => Promise<void>;
  onClose: () => void;
}) {
  const habits = useLiveQuery(
    () => db.habits.filter((h) => !h.archivedAt && Boolean(h.pings || h.reminderTime)).toArray(),
    [],
  );
  const metrics = useLiveQuery(
    () => db.bioMetrics.filter((m) => !m.archivedAt && Boolean(m.pings)).toArray(),
    [],
  );
  const clearHabit = async (id: string) => {
    await updateHabit(id, { pings: undefined, reminderTime: undefined });
    await syncPush();
  };
  const clearMetric = async (id: string) => {
    await setBioMetricPings(id, undefined);
    await syncPush();
  };

  return (
    <InfoSheet title="All notifications" onClose={onClose}>
      <p className="placeholder">// every ping that can fire, by source. uncheck to turn one off</p>
      <h3 className="card-title" style={{ marginTop: 10 }}>System</h3>
      {SYSTEM_PINGS.map(({ key, label }) => {
        const cfg = reminders[key] as { on: boolean };
        return (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={cfg.on}
              onChange={(e) => update({ [key]: { ...cfg, on: e.target.checked } } as Partial<Reminders>)}
            />
            {label} <span className="off-day-tag">system</span>
          </label>
        );
      })}

      <h3 className="card-title" style={{ marginTop: 12 }}>Directives</h3>
      {(habits ?? []).length === 0 ? (
        <p className="placeholder">// no directive pings set — add one in a directive's editor</p>
      ) : (
        (habits ?? []).map((h) => (
          <label className="check-label" key={h.id}>
            <input type="checkbox" checked onChange={() => clearHabit(h.id)} />
            {h.icon} {h.name}{" "}
            <span className="off-day-tag">
              directive · {h.pings ? `×${h.pings.times}/day` : `🔔${h.reminderTime}`}
            </span>
          </label>
        ))
      )}

      <h3 className="card-title" style={{ marginTop: 12 }}>Bio-metrics</h3>
      {(metrics ?? []).length === 0 ? (
        <p className="placeholder">// no bio-metric pings set</p>
      ) : (
        (metrics ?? []).map((m) => (
          <label className="check-label" key={m.id}>
            <input type="checkbox" checked onChange={() => clearMetric(m.id)} />
            {m.name} <span className="off-day-tag">bio-metric · ×{m.pings?.times}/day</span>
          </label>
        ))
      )}
    </InfoSheet>
  );
}

export function ReminderUplink() {
  const settings = useSettings();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showSelfHost, setShowSelfHost] = useState(false);
  const [inventory, setInventory] = useState(false);

  const reminders = useLiveQuery(async () => {
    const row = await db.kv.get("reminders");
    return { ...DEFAULT_REMINDERS, ...((row?.value as Partial<Reminders>) ?? {}) };
  }, []);

  useEffect(() => {
    pushActive().then(setActive);
  }, []);

  if (!reminders) return null;

  const update = async (patch: Partial<Reminders>) => {
    await saveReminders(patch);
    await syncPush(); // re-upload slots immediately when the schedule changes
  };

  const toggle = async () => {
    if (active) {
      await disablePush();
      setActive(false);
      setStatus("Uplink severed. In-app pings still work.");
    } else {
      const r = await enablePush();
      setActive(r.ok);
      setStatus(r.ok ? "Uplink established — reminders will arrive even when the app is closed." : r.reason ?? null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Reminder Uplink (Optional)</h2>
        {reminders.enabled && (
          <button className="link-btn" onClick={() => setInventory(true)}>
            all pings
          </button>
        )}
      </div>
      {inventory && (
        <NotificationInventory reminders={reminders} update={update} onClose={() => setInventory(false)} />
      )}
      <p className="placeholder">
        // pushes are opt-in. the relay stores only an anonymous push address + time
        slots — your schedule, logs, and identity never leave this device
      </p>

      <div className="form-row">
        <button className={active ? "btn ghost" : "btn"} onClick={toggle}>
          {active ? "Sever uplink" : "Enable push reminders"}
        </button>
        {active && (
          <button
            className="btn"
            onClick={async () => {
              setStatus("Test ping requested — lock your phone and watch for it…");
              const r = await testPush();
              if (!r.ok) setStatus(`Test failed: ${r.reason}`);
            }}
          >
            Send test ping
          </button>
        )}
      </div>
      {status && <p className="placeholder">// {status}</p>}

      <div className="form-block">
        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <strong>Notifications</strong>
          <span className="off-day-tag">master switch — off hides every ping option</span>
        </label>
        {reminders.enabled && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={reminders.quiet.on}
              onChange={(e) => update({ quiet: { ...reminders.quiet, on: e.target.checked } })}
            />
            Quiet hours
            <input
              type="time"
              className="input time-input"
              value={reminders.quiet.start}
              onChange={(e) => update({ quiet: { ...reminders.quiet, start: e.target.value } })}
              aria-label="Quiet hours start"
            />
            –
            <input
              type="time"
              className="input time-input"
              value={reminders.quiet.end}
              onChange={(e) => update({ quiet: { ...reminders.quiet, end: e.target.value } })}
              aria-label="Quiet hours end"
            />
            <span className="off-day-tag">pings here wait until it lifts</span>
          </label>
        )}
      </div>

      {reminders.enabled && (
      <div className="form-block">
        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.morning.on}
            onChange={(e) => update({ morning: { ...reminders.morning, on: e.target.checked } })}
          />
          Morning boot —
          <input
            type="time"
            className="input time-input"
            value={reminders.morning.time}
            onChange={(e) => update({ morning: { ...reminders.morning, time: e.target.value } })}
            aria-label="Morning reminder time"
          />
          <span className="off-day-tag">"Rise and shine, Night City."</span>
        </label>

        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.water.on}
            onChange={(e) => update({ water: { ...reminders.water, on: e.target.checked } })}
          />
          Hydration ×
          <input
            type="number"
            className="input num-input-sm"
            min={1}
            max={12}
            value={reminders.water.count}
            onChange={(e) =>
              update({ water: { ...reminders.water, count: Math.max(1, Math.min(12, Number(e.target.value) || 5)) } })
            }
            aria-label="Water reminders per day"
          />
          between
          <input
            type="time"
            className="input time-input"
            value={reminders.water.start}
            onChange={(e) => update({ water: { ...reminders.water, start: e.target.value } })}
            aria-label="Water window start"
          />
          –
          <input
            type="time"
            className="input time-input"
            value={reminders.water.end}
            onChange={(e) => update({ water: { ...reminders.water, end: e.target.value } })}
            aria-label="Water window end"
          />
        </label>

        <div className="check-label">
          <input
            type="checkbox"
            checked={reminders.workout.on}
            onChange={(e) => update({ workout: { ...reminders.workout, on: e.target.checked } })}
            aria-label="Workout reminders on"
          />
          Training —
          <span className="weekday-row inline" role="group" aria-label="Workout days">
            {WEEKDAY_LABELS.map((label, i) => (
              <button
                key={i}
                className={reminders.workout.days.includes(i) ? "day-toggle sm on" : "day-toggle sm"}
                aria-pressed={reminders.workout.days.includes(i)}
                onClick={() =>
                  update({
                    workout: {
                      ...reminders.workout,
                      days: reminders.workout.days.includes(i)
                        ? reminders.workout.days.filter((d) => d !== i)
                        : [...reminders.workout.days, i].sort(),
                    },
                  })
                }
              >
                {label}
              </button>
            ))}
          </span>
          <input
            type="time"
            className="input time-input"
            value={reminders.workout.time}
            onChange={(e) => update({ workout: { ...reminders.workout, time: e.target.value } })}
            aria-label="Workout reminder time"
          />
        </div>

        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.highlight.on}
            onChange={(e) => update({ highlight: { ...reminders.highlight, on: e.target.checked } })}
          />
          Highlight nudge —
          <input
            type="time"
            className="input time-input"
            value={reminders.highlight.time}
            onChange={(e) => update({ highlight: { ...reminders.highlight, time: e.target.value } })}
            aria-label="Highlight reminder time"
          />
          <span className="off-day-tag">"One good frame from today."</span>
        </label>

        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.motivation.on}
            onChange={(e) => update({ motivation: { ...reminders.motivation, on: e.target.checked } })}
          />
          Motivation ×
          <input
            type="number"
            className="input num-input-sm"
            min={1}
            max={5}
            value={reminders.motivation.count}
            onChange={(e) =>
              update({ motivation: { ...reminders.motivation, count: Math.max(1, Math.min(5, Number(e.target.value) || 2)) } })
            }
            aria-label="Motivation pings per day"
          />
          between
          <input
            type="time"
            className="input time-input"
            value={reminders.motivation.start}
            onChange={(e) => update({ motivation: { ...reminders.motivation, start: e.target.value } })}
            aria-label="Motivation window start"
          />
          –
          <input
            type="time"
            className="input time-input"
            value={reminders.motivation.end}
            onChange={(e) => update({ motivation: { ...reminders.motivation, end: e.target.value } })}
            aria-label="Motivation window end"
          />
          <span className="off-day-tag">random encouragement, e.g. "Still breathing, still winning."</span>
        </label>

        <label className="check-label">
          <input
            type="checkbox"
            checked={reminders.catchup.on}
            onChange={(e) => update({ catchup: { ...reminders.catchup, on: e.target.checked } })}
          />
          Log catch-up —
          <input
            type="time"
            className="input time-input"
            value={reminders.catchup.time}
            onChange={(e) => update({ catchup: { ...reminders.catchup, time: e.target.value } })}
            aria-label="Catch-up reminder time"
          />
          <span className="off-day-tag">"Sync your logs before lights out."</span>
        </label>
      </div>
      )}

      <button className="link-btn" onClick={() => setShowSelfHost(!showSelfHost)}>
        {showSelfHost ? "hide" : "self-hosting?"} — point at your own relay
      </button>
      {showSelfHost && (
        <div className="form-block">
          <input
            className="input"
            placeholder="https://your-relay.example (Cloudflare or home server)"
            value={settings.relayUrl ?? ""}
            onChange={(e) => saveSettings({ relayUrl: e.target.value.trim() })}
            aria-label="Relay URL"
          />
          <input
            className="input"
            placeholder="VAPID public key from your relay"
            value={settings.relayVapidKey ?? ""}
            onChange={(e) => saveSettings({ relayVapidKey: e.target.value.trim() })}
            aria-label="VAPID public key"
            style={{ marginTop: 8 }}
          />
          <p className="placeholder">// see About → self-host the notification relay</p>
        </div>
      )}
    </div>
  );
}
