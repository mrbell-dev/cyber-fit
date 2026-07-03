import type { WaterLog } from "../../engine/index.ts";
import { formatWater, waterQuickSizes, waterTotal } from "../../engine/index.ts";
import { logWater } from "../../db/repo.ts";

export function WaterGauge({
  logs,
  goalMl,
  unit,
}: {
  logs: WaterLog[];
  goalMl: number;
  unit: "ml" | "oz";
}) {
  const total = waterTotal(logs);
  const pct = Math.min(100, Math.round((total / goalMl) * 100));
  const met = total >= goalMl;
  const sizes = waterQuickSizes(unit);

  return (
    <div className="card">
      <h2 className="card-title">Hydration</h2>
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
