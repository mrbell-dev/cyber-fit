import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  WEIGHIN_CADENCES,
  weighinCadenceOf,
  type BioMetric,
  type BioReading,
  type DayKey,
  type WeighinCadence,
} from "../../engine/index.ts";
import {
  addBioMetric,
  archiveBioMetric,
  logBioReading,
  logWeight,
  saveSettings,
  setBioMetricPings,
  undoLastBioReading,
  undoLastWeight,
} from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";
import { InfoButton, InfoSheet } from "./InfoSheet.tsx";
import { useBodyLogs, WeightChart, WeightHistory } from "./BodyMetrics.tsx";

/** Ready-made metrics — the doctor's-orders shortlist. Weight is separate
 *  (it has its own cadence-based XP + trend), so it isn't in this list. */
const METRIC_PRESETS: { name: string; unit: string }[] = [
  { name: "Blood pressure", unit: "mmHg" },
  { name: "Blood glucose", unit: "mg/dL" },
  { name: "Resting heart rate", unit: "bpm" },
  { name: "Blood oxygen", unit: "%" },
  { name: "Body temperature", unit: "°F" },
];

function useNotifOn(): boolean {
  return (
    useLiveQuery(async () => {
      const row = await db.kv.get("reminders");
      return (row?.value as { enabled?: boolean } | undefined)?.enabled !== false;
    }, []) ?? true
  );
}

/** Numeric trend for a custom metric — number over every point. Non-numeric
 *  readings (e.g. "120/80") are shown as history only. */
function BioChart({ readings }: { readings: BioReading[] }) {
  const numeric = readings.filter((r) => Number.isFinite(Number(r.value)));
  if (numeric.length < 2) {
    return <p className="placeholder">// two+ numeric readings needed to draw a trend</p>;
  }
  const pts = numeric.slice(-14);
  const vals = pts.map((r) => Number(r.value));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const W = 320;
  const H = 104;
  const PAD = { top: 22, right: 14, bottom: 10, left: 14 };
  const x = (i: number) => PAD.left + (W - PAD.left - PAD.right) * (i / Math.max(1, pts.length - 1));
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - min) / span);
  const path = pts.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(r.value)).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Metric trend">
      <path d={path} className="chart-line" />
      {pts.map((r, i) => (
        <g key={r.id}>
          <circle cx={x(i)} cy={y(Number(r.value))} r="3.5" className="chart-dot">
            <title>{`${r.dayKey}: ${r.value}`}</title>
          </circle>
          <text x={x(i)} y={y(Number(r.value)) - 7} className="chart-point-label" textAnchor="middle">
            {r.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** One custom metric: log a reading, ⓘ (trend + history + undo), edit pings. */
function MetricRow({ metric, readings, notifOn }: { metric: BioMetric; readings: BioReading[]; notifOn: boolean }) {
  const [value, setValue] = useState("");
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const mine = readings.filter((r) => r.metricId === metric.id);
  const last = mine[mine.length - 1];

  const log = async () => {
    if (!value.trim()) return;
    await logBioReading(metric.id, value);
    setValue("");
  };

  const pings = metric.pings;
  const setPingCount = async (times: number) => {
    if (times <= 0) return setBioMetricPings(metric.id, undefined);
    await setBioMetricPings(metric.id, { times, start: pings?.start ?? "08:00", end: pings?.end ?? "20:00" });
  };

  return (
    <div className="metric-block">
      <div className="row-item">
        <span>
          {metric.name}
          <span className="off-day-tag">
            {metric.unit ? ` · ${metric.unit}` : ""}
            {metric.pings ? ` · 🔔×${metric.pings.times}` : ""}
            {last ? ` · last ${last.value}` : ""}
          </span>
        </span>
        <span className="row-actions">
          <button className="link-btn" onClick={() => setEditing(!editing)}>
            edit
          </button>
          {mine.length >= 2 && <InfoButton onClick={() => setInfo(true)} label={`${metric.name} history`} />}
        </span>
      </div>

      {info && (
        <InfoSheet title={metric.name} onClose={() => setInfo(false)}>
          <BioChart readings={mine} />
          {last && (
            <button className="link-btn danger" onClick={() => undoLastBioReading(metric.id)}>
              ↩ undo last reading ({last.value})
            </button>
          )}
          <div className="history-list">
            {[...mine].reverse().map((r) => (
              <div className="row-item" key={r.id}>
                <span>
                  <strong>{r.value}</strong> {metric.unit}
                </span>
                <span className="off-day-tag">{r.dayKey}</span>
              </div>
            ))}
          </div>
        </InfoSheet>
      )}

      {editing && (
        <div className="form-block">
          {notifOn ? (
            <label className="check-label">
              Remind me
              <input
                type="number"
                className="input num-input-sm"
                min={0}
                max={6}
                value={pings?.times ?? 0}
                onChange={(e) => setPingCount(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
                aria-label={`${metric.name} reminders per day`}
              />
              ×/day (0 = off)
              {pings && (
                <>
                  <input
                    type="time"
                    className="input time-input"
                    value={pings.start}
                    onChange={(e) => setBioMetricPings(metric.id, { ...pings, start: e.target.value })}
                    aria-label="Reminder window start"
                  />
                  –
                  <input
                    type="time"
                    className="input time-input"
                    value={pings.end}
                    onChange={(e) => setBioMetricPings(metric.id, { ...pings, end: e.target.value })}
                    aria-label="Reminder window end"
                  />
                </>
              )}
            </label>
          ) : (
            <p className="placeholder">// notifications are globally off — enable them in Reminder Uplink</p>
          )}
          <button className="link-btn danger" onClick={() => archiveBioMetric(metric.id)}>
            archive this metric
          </button>
        </div>
      )}

      <div className="form-row">
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`reading${metric.unit ? ` (${metric.unit})` : ""} — e.g. 120/80 works too`}
          aria-label={`${metric.name} reading`}
          onKeyDown={(e) => e.key === "Enter" && log()}
        />
        <button className="btn" onClick={log} disabled={!value.trim()}>
          Log
        </button>
      </div>
    </div>
  );
}

/** Built-in weight metric — backed by bodyLogs, so it keeps cadence-based XP
 *  and the numbered trend. Presented as one metric among the others. */
function WeightRow({ today, notifOn: _notifOn }: { today: DayKey; notifOn: boolean }) {
  const settings = useSettings();
  const unit = settings.weightUnit ?? "lbs";
  const cadence = weighinCadenceOf(settings);
  const [value, setValue] = useState("");
  const [info, setInfo] = useState(false);
  const [editing, setEditing] = useState(false);
  const logs = useBodyLogs();
  if (!logs) return null;

  const last = logs[logs.length - 1];
  const prev = logs[logs.length - 2];
  const delta = last && prev && last.unit === prev.unit ? last.weight - prev.weight : null;
  void today;

  const submit = async () => {
    const w = Number(value);
    if (!w) return;
    await logWeight(w, unit);
    setValue("");
  };

  return (
    <div className="metric-block">
      <div className="row-item">
        <span>
          Weight
          <span className="off-day-tag">
            {" "}· {unit} · {cadence.label.toLowerCase()}
            {last ? ` · last ${last.weight}` : ""}
            {delta !== null ? ` (${delta > 0 ? "+" : ""}${Math.round(delta * 10) / 10})` : ""}
          </span>
        </span>
        <span className="row-actions">
          <button className="link-btn" onClick={() => setEditing(!editing)}>
            edit
          </button>
          {logs.length >= 2 && <InfoButton onClick={() => setInfo(true)} label="Weight trend + history" />}
        </span>
      </div>

      {info && (
        <InfoSheet title="Weight Trend" onClose={() => setInfo(false)}>
          <WeightChart />
          {last && (
            <button className="link-btn danger" onClick={() => undoLastWeight()}>
              ↩ undo last scan ({last.weight} {last.unit})
            </button>
          )}
          <WeightHistory logs={logs} />
        </InfoSheet>
      )}

      {editing && (
        <div className="form-block">
          <label className="check-label">
            Cadence
            <select
              className="input"
              value={cadence.id}
              onChange={(e) => saveSettings({ weighinCadence: e.target.value as WeighinCadence })}
              aria-label="Weigh-in cadence"
            >
              {WEIGHIN_CADENCES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <p className="placeholder">// the trend is the signal, fluctuations are noise — early scans are fine, they just don't earn XP</p>
        </div>
      )}

      <div className="form-row">
        <input
          className="input num-input"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={unit}
          aria-label={`Weight in ${unit}`}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit} disabled={!Number(value)}>
          Log scan
        </button>
      </div>
    </div>
  );
}

/** Add a metric — pick a preset or roll your own, with optional reminders. */
function AddMetric({
  notifOn,
  showWeightOption,
  onAddWeight,
  onClose,
}: {
  notifOn: boolean;
  showWeightOption: boolean;
  onAddWeight: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [times, setTimes] = useState(0);

  const add = async (n: string, u: string) => {
    if (!n.trim()) return;
    await addBioMetric({
      name: n,
      unit: u,
      ...(times > 0 ? { pings: { times, start: "08:00", end: "20:00" } } : {}),
    });
    onClose();
  };

  return (
    <InfoSheet title="Add a metric" onClose={onClose}>
      <p className="placeholder">// tap a preset, or define your own below</p>
      {showWeightOption && (
        <button className="suggest-item" onClick={onAddWeight}>
          <span>Weight</span>
          <span className="off-day-tag">built-in · cadence + trend</span>
        </button>
      )}
      {METRIC_PRESETS.map((p) => (
        <button key={p.name} className="suggest-item" onClick={() => add(p.name, p.unit)}>
          <span>{p.name}</span>
          <span className="off-day-tag">{p.unit}</span>
        </button>
      ))}
      <div className="form-block">
        <div className="form-row">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Custom metric (e.g. Peak flow)"
            aria-label="Metric name"
          />
          <input
            className="input num-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit"
            aria-label="Metric unit"
          />
        </div>
        {notifOn && (
          <label className="check-label">
            Remind me
            <input
              type="number"
              className="input num-input-sm"
              min={0}
              max={6}
              value={times}
              onChange={(e) => setTimes(Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
              aria-label="Reminders per day (0 = none)"
            />
            ×/day (0 = no pings)
          </label>
        )}
        <button className="btn" onClick={() => add(name, unit)} disabled={!name.trim()}>
          Track metric
        </button>
      </div>
    </InfoSheet>
  );
}

/** Unified Bio-Scan: weight (built-in) + any metric you add — one card, each
 *  row with its own log field, ⓘ chart/history/undo, and editable reminders. */
export function BioScanCard({ today }: { today: DayKey }) {
  const [adding, setAdding] = useState(false);
  const settings = useSettings();
  const notifOn = useNotifOn();
  const metrics = useLiveQuery(() => db.bioMetrics.filter((m) => !m.archivedAt).toArray(), []);
  const readings = useLiveQuery(async () => {
    const all = await db.bioReadings.toArray();
    return all.sort((a, b) => a.ts - b.ts);
  }, []);
  const bodyLogs = useBodyLogs();
  if (!metrics || !readings || !bodyLogs) return null;

  // Weight shows once it has data (no longer a hardwired default) — or add it
  // deliberately from the "+" like any other metric.
  const showWeight = bodyLogs.length > 0 || Boolean(settings.weightTracked);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Bio-Scan</h2>
        <button className="card-add" aria-label="Add metric" onClick={() => setAdding(true)}>
          +
        </button>
      </div>
      {adding && (
        <AddMetric
          notifOn={notifOn}
          showWeightOption={!showWeight}
          onAddWeight={() => {
            saveSettings({ weightTracked: true });
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {showWeight && <WeightRow today={today} notifOn={notifOn} />}
      {metrics.map((m) => (
        <MetricRow key={m.id} metric={m} readings={readings} notifOn={notifOn} />
      ))}

      {!showWeight && metrics.length === 0 && (
        <p className="placeholder">
          // nothing tracked yet — tap ＋ to add weight, blood pressure, glucose, or your own.
          the doctor asked for BP twice a day? this is where it lives
        </p>
      )}
    </div>
  );
}
