import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { DEFAULT_REMINDERS, type Reminders } from "../../engine/index.ts";
import { saveSettings } from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";
import { disablePush, enablePush, pushActive, saveReminders, syncPush } from "../notify.ts";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function ReminderUplink() {
  const settings = useSettings();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showSelfHost, setShowSelfHost] = useState(false);

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
      <h2 className="card-title">Reminder Uplink (Optional)</h2>
      <p className="placeholder">
        // pushes are opt-in. the relay stores only an anonymous push address + time
        slots — your schedule, logs, and identity never leave this device
      </p>

      <button className={active ? "btn ghost" : "btn"} onClick={toggle}>
        {active ? "Sever uplink" : "Enable push reminders"}
      </button>
      {status && <p className="placeholder">// {status}</p>}

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
