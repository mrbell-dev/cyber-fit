import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { BioMetric } from "../../engine/index.ts";
import { addBioMetric, archiveBioMetric, logBioReading } from "../../db/repo.ts";
import { syncPush } from "../notify.ts";

/** User-defined bio metrics beyond weight — BP for the doctor, resting HR,
 *  whatever the care team asked for. Each gets readings + a chart (numeric). */
export function BioMetricsCard() {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [times, setTimes] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  const metrics = useLiveQuery(() => db.bioMetrics.filter((m) => !m.archivedAt).toArray(), []);
  const notifOn = useLiveQuery(async () => {
    const row = await db.kv.get("reminders");
    return (row?.value as { enabled?: boolean } | undefined)?.enabled !== false;
  }, []);
  const readings = useLiveQuery(async () => {
    const all = await db.bioReadings.toArray();
    return all.sort((a, b) => a.ts - b.ts);
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    await addBioMetric({
      name,
      unit,
      ...(times > 0 ? { pings: { times, start: "08:00", end: "20:00" } } : {}),
    });
    if (times > 0) await syncPush();
    setName("");
    setUnit("");
    setTimes(0);
  };

  const log = async (m: BioMetric) => {
    await logBioReading(m.id, values[m.id] ?? "");
    setValues({ ...values, [m.id]: "" });
  };

  return (
    <div className="card">
      <h2 className="card-title">Custom Bio-Metrics</h2>
      {(metrics ?? []).map((m) => {
        const mine = (readings ?? []).filter((r) => r.metricId === m.id);
        const last = mine[mine.length - 1];
        const numeric = mine.filter((r) => Number.isFinite(Number(r.value)));
        return (
          <div className="metric-block" key={m.id}>
            <div className="row-item">
              <span>
                {m.name}
                <span className="off-day-tag">
                  {m.unit ? ` · ${m.unit}` : ""}
                  {m.pings ? ` · 🔔×${m.pings.times}` : ""}
                  {last ? ` · last ${last.value}` : ""}
                </span>
              </span>
              <button className="link-btn" onClick={() => archiveBioMetric(m.id)}>
                archive
              </button>
            </div>
            <div className="form-row">
              <input
                className="input"
                value={values[m.id] ?? ""}
                onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                placeholder={`reading${m.unit ? ` (${m.unit})` : ""} — e.g. 120/80 works too`}
                aria-label={`${m.name} reading`}
                onKeyDown={(e) => e.key === "Enter" && log(m)}
              />
              <button className="btn" onClick={() => log(m)} disabled={!(values[m.id] ?? "").trim()}>
                Log
              </button>
            </div>
            {numeric.length >= 2 && (
              <svg viewBox="0 0 320 60" className="chart-svg" role="img" aria-label={`${m.name} trend`}>
                {(() => {
                  const pts = numeric.slice(-14);
                  const vals = pts.map((r) => Number(r.value));
                  const min = Math.min(...vals);
                  const max = Math.max(...vals);
                  const span = Math.max(max - min, 1);
                  const x = (i: number) => 8 + (304 * i) / Math.max(1, pts.length - 1);
                  const y = (v: number) => 8 + 44 * (1 - (v - min) / span);
                  return (
                    <>
                      <path
                        d={pts.map((r, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(r.value)).toFixed(1)}`).join(" ")}
                        className="chart-line"
                      />
                      {pts.map((r, i) => (
                        <circle key={r.id} cx={x(i)} cy={y(Number(r.value))} r="3" className="chart-dot">
                          <title>{`${r.dayKey}: ${r.value}`}</title>
                        </circle>
                      ))}
                    </>
                  );
                })()}
              </svg>
            )}
          </div>
        );
      })}

      <div className="form-block">
        <div className="form-row">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New metric (e.g. Blood pressure)"
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
        {notifOn !== false && (
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
        <button className="btn" onClick={add} disabled={!name.trim()}>
          Track metric
        </button>
      </div>
    </div>
  );
}
