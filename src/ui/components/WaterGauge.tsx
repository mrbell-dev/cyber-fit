import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { addDays, formatWater, waterQuickSizes, waterTotal, type DayKey, type WaterLog } from "../../engine/index.ts";
import { logWater } from "../../db/repo.ts";
import { InfoButton, InfoSheet } from "./InfoSheet.tsx";

/** Hydration history — last 14 days of totals vs goal. Self-contained (queries
 *  its own logs) so it can live in the Hydration ⓘ sheet. */
function HydrationHistory({ today, goalMl, unit }: { today: DayKey; goalMl: number; unit: "ml" | "oz" }) {
  const all = useLiveQuery(() => db.waterLogs.toArray(), []);
  if (!all) return null;
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, total: waterTotal(all.filter((l) => l.dayKey === day)) };
  });
  const maxMl = Math.max(goalMl, ...days.map((d) => d.total));
  const hitDays = days.filter((d) => d.total >= goalMl).length;

  return (
    <>
      <p className="placeholder">// goal hit on {hitDays}/14 days · goal {formatWater(goalMl, unit)}</p>
      <div className="water-week" role="img" aria-label="Water intake, last 14 days">
        {days.map(({ day, total }) => (
          <div className="water-day" key={day}>
            <div
              className={total >= goalMl ? "water-col met" : "water-col"}
              style={{ height: `${Math.max(4, Math.round((total / maxMl) * 72))}px` }}
              title={`${day}: ${formatWater(total, unit)}`}
            />
            <span className="water-day-label">{day.slice(8)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function WaterGauge({
  logs,
  goalMl,
  unit,
  today,
}: {
  logs: WaterLog[];
  goalMl: number;
  unit: "ml" | "oz";
  today: DayKey;
}) {
  const [info, setInfo] = useState(false);
  const total = waterTotal(logs);
  const pct = Math.min(100, Math.round((total / goalMl) * 100));
  const met = total >= goalMl;
  const sizes = waterQuickSizes(unit);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Hydration</h2>
        <InfoButton onClick={() => setInfo(true)} label="Hydration history" />
      </div>
      {info && (
        <InfoSheet title="Hydration — last 14 days" onClose={() => setInfo(false)}>
          <HydrationHistory today={today} goalMl={goalMl} unit={unit} />
        </InfoSheet>
      )}
      <div
        className="water-bar"
        role="progressbar"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={goalMl}
        aria-label="Water intake"
      >
        <div className={met ? "water-fill met" : "water-fill"} style={{ width: `${pct}%` }} />
        <span className="water-label">
          {formatWater(total, unit)} / {formatWater(goalMl, unit)}
          {met ? " — GOAL SYNCED" : ""}
        </span>
      </div>
      <div className="water-actions">
        {sizes.map((s) => (
          <button key={s.label} className="btn water-btn" onClick={() => logWater(s.ml)}>
            {s.label}
          </button>
        ))}
        <button
          className="btn ghost water-btn"
          onClick={() => total > 0 && logWater(-sizes[0].ml)}
          aria-label={`Undo ${sizes[0].label.slice(1)}`}
        >
          −{sizes[0].label.slice(1)}
        </button>
      </div>
    </div>
  );
}
