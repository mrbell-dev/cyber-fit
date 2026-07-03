import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { addDays, diffDays, type BodyLog, type DayKey } from "../../engine/index.ts";
import { logWeight } from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";

const CHECKIN_DAYS = 30;

export function useBodyLogs(): BodyLog[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.bodyLogs.toArray();
    return all.sort((a, b) => a.ts - b.ts);
  }, []);
}

/** Monthly weigh-in card. Cadence over frequency: fluctuations are noise, the
 *  trend is the signal — XP only rewards ~monthly check-ins by design. */
export function BodyCard({ today }: { today: DayKey }) {
  const settings = useSettings();
  const unit = settings.weightUnit ?? "lbs";
  const [value, setValue] = useState("");
  const logs = useBodyLogs();

  if (!logs) return null;
  const last = logs[logs.length - 1];
  const prev = logs[logs.length - 2];
  const daysSince = last ? diffDays(last.dayKey, today) : null;
  const due = daysSince === null || daysSince >= CHECKIN_DAYS;
  const delta = last && prev && last.unit === prev.unit ? last.weight - prev.weight : null;

  const submit = async () => {
    const w = Number(value);
    if (!w) return;
    await logWeight(w, unit);
    setValue("");
  };

  return (
    <div className="card">
      <h2 className="card-title">Bio-Scan — Monthly Weigh-in</h2>
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
          ? "// scan window open — monthly cadence, not daily; fluctuations are noise"
          : `// next check-in ~${last ? addDays(last.dayKey, CHECKIN_DAYS) : ""} — early scans are fine, they just don't earn XP`}
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

/** Single-series weight trend — line + dots, latest value direct-labeled,
 *  y-domain padded around the data (never forced to zero for weight). */
export function WeightChart() {
  const logs = useBodyLogs();
  if (!logs || logs.length < 2) return null;

  const recent = logs.slice(-12);
  const W = 320;
  const H = 96;
  const PAD = { top: 14, right: 44, bottom: 8, left: 8 };
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
    <div className="card">
      <h2 className="card-title">Weight Trend — last {recent.length} scans</h2>
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
          <circle key={l.id} cx={x(i)} cy={y(l.weight)} r="3.5" className="chart-dot">
            <title>{`${l.dayKey}: ${l.weight} ${l.unit}`}</title>
          </circle>
        ))}
        <text x={x(recent.length - 1) + 8} y={y(lastLog.weight) + 4} className="chart-label">
          {lastLog.weight}
        </text>
      </svg>
      <p className="placeholder">// monthly signal, not daily noise</p>
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
    <div className="card">
      <h2 className="card-title">Training Volume — sessions / week</h2>
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
    </div>
  );
}
