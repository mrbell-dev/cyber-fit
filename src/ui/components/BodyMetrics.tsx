import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  addDays,
  diffDays,
  WEIGHIN_CADENCES,
  weighinCadenceOf,
  type BodyLog,
  type DayKey,
  type WeighinCadence,
} from "../../engine/index.ts";
import { logWeight, saveSettings } from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";
import { InfoButton, InfoSheet } from "./InfoSheet.tsx";

export function useBodyLogs(): BodyLog[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.bodyLogs.toArray();
    return all.sort((a, b) => a.ts - b.ts);
  }, []);
}

/** Weigh-in card. Cadence is the user's call (daily → bimonthly); XP spacing
 *  scales with it, so scans faster than your own rhythm are never incentivized. */
export function BodyCard({ today }: { today: DayKey }) {
  const settings = useSettings();
  const unit = settings.weightUnit ?? "lbs";
  const cadence = weighinCadenceOf(settings);
  const [value, setValue] = useState("");
  const [info, setInfo] = useState(false);
  const logs = useBodyLogs();

  if (!logs) return null;
  const last = logs[logs.length - 1];
  const prev = logs[logs.length - 2];
  const daysSince = last ? diffDays(last.dayKey, today) : null;
  const due = daysSince === null || daysSince >= cadence.days;
  const delta = last && prev && last.unit === prev.unit ? last.weight - prev.weight : null;

  const submit = async () => {
    const w = Number(value);
    if (!w) return;
    await logWeight(w, unit);
    setValue("");
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Bio-Scan — Weigh-in</h2>
        {logs.length >= 2 && (
          <InfoButton onClick={() => setInfo(true)} label="Weight trend + history" />
        )}
      </div>
      {info && (
        <InfoSheet title="Weight Trend" onClose={() => setInfo(false)}>
          <WeightChart />
          <WeightHistory logs={logs} />
        </InfoSheet>
      )}
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
      {last ? (
        <p>
          Last scan: <strong>{last.weight} {last.unit}</strong>
          <span className="off-day-tag"> · {last.dayKey}</span>
          {delta !== null && (
            <span className="off-day-tag">
              {" "}· {delta > 0 ? "+" : ""}{Math.round(delta * 10) / 10} {last.unit} vs prior
            </span>
          )}
        </p>
      ) : (
        <p className="placeholder">// no scans yet — set a baseline whenever you're ready</p>
      )}
      <p className="placeholder">
        {due
          ? `// scan window open — ${cadence.label.toLowerCase()} cadence; the trend is the signal, fluctuations are noise`
          : `// next check-in ~${last ? addDays(last.dayKey, cadence.days) : ""} — early scans are fine, they just don't earn XP`}
      </p>
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

/** Single-series weight trend — line + dots, a number over EVERY point,
 *  y-domain padded around the data (never forced to zero for weight).
 *  Renders bare (no card) — it lives inside the Bio-Scan ⓘ sheet. */
export function WeightChart() {
  const logs = useBodyLogs();
  if (!logs || logs.length < 2) return null;

  const recent = logs.slice(-12);
  const W = 320;
  const H = 104;
  const PAD = { top: 22, right: 14, bottom: 10, left: 14 };
  const ws = recent.map((l) => l.weight);
  const min = Math.min(...ws);
  const max = Math.max(...ws);
  const span = Math.max(max - min, 2); // at least ±1 so a flat line stays centered
  const y = (w: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (w - (min - span * 0.1)) / (span * 1.2));
  const x = (i: number) =>
    PAD.left + (recent.length === 1 ? 0 : (W - PAD.left - PAD.right) * (i / (recent.length - 1)));
  const path = recent.map((l, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(l.weight).toFixed(1)}`).join(" ");
  const lastLog = recent[recent.length - 1];

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`Weight trend, latest ${lastLog.weight} ${lastLog.unit}`}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={y(min)} y2={y(min)} className="chart-grid" />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(max)} y2={y(max)} className="chart-grid" />
        <path d={path} className="chart-line" />
        {recent.map((l, i) => (
          <g key={l.id}>
            <circle cx={x(i)} cy={y(l.weight)} r="3.5" className="chart-dot">
              <title>{`${l.dayKey}: ${l.weight} ${l.unit}`}</title>
            </circle>
            <text x={x(i)} y={y(l.weight) - 7} className="chart-point-label" textAnchor="middle">
              {l.weight}
            </text>
          </g>
        ))}
      </svg>
      <p className="placeholder">// {lastLog.unit} · monthly signal, not daily noise</p>
    </>
  );
}

/** Full scan list — the "history" half of the Bio-Scan ⓘ sheet. */
function WeightHistory({ logs }: { logs: BodyLog[] }) {
  const rows = [...logs].sort((a, b) => b.ts - a.ts);
  return (
    <div className="history-list">
      {rows.map((l, i) => {
        const prior = rows[i + 1];
        const d = prior && prior.unit === l.unit ? l.weight - prior.weight : null;
        return (
          <div className="row-item" key={l.id}>
            <span>
              <strong>{l.weight} {l.unit}</strong>
              {d !== null && (
                <span className="off-day-tag">
                  {" "}· {d > 0 ? "+" : ""}{Math.round(d * 10) / 10}
                </span>
              )}
            </span>
            <span className="off-day-tag">{l.dayKey}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Single-series weekly training volume — sessions per week, last 8 weeks. */
export function VolumeChart({ today }: { today: DayKey }) {
  const workouts = useLiveQuery(() => db.workoutLogs.toArray(), []);
  if (!workouts || workouts.length === 0) return null;

  // 8 rolling 7-day buckets, newest ending today.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i));
    const start = addDays(end, -6);
    const count = workouts.filter((w) => w.dayKey >= start && w.dayKey <= end).length;
    return { label: i === 7 ? "now" : end.slice(5), count };
  });
  const maxCount = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <>
      <p className="placeholder">// sessions per week — last 8 weeks</p>
      <div className="volume-week" role="img" aria-label="Workouts per week, last 8 weeks">
        {weeks.map((w, i) => (
          <div className="water-day" key={i}>
            <div
              className="volume-col"
              style={{ height: `${Math.max(4, Math.round((w.count / maxCount) * 72))}px` }}
              title={`${w.label}: ${w.count} session${w.count === 1 ? "" : "s"}`}
            />
            <span className="water-day-label">{w.count}</span>
          </div>
        ))}
      </div>
    </>
  );
}
