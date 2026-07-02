import type { WaterLog } from "../../engine/index.ts";
import { waterTotal } from "../../engine/index.ts";
import { logWater } from "../../db/repo.ts";

export function WaterGauge({ logs, goalMl }: { logs: WaterLog[]; goalMl: number }) {
  const total = waterTotal(logs);
  const pct = Math.min(100, Math.round((total / goalMl) * 100));
  const met = total >= goalMl;

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
          {total} / {goalMl} ml{met ? " — GOAL SYNCED" : ""}
        </span>
      </div>
      <div className="water-actions">
        <button className="btn water-btn" onClick={() => logWater(250)}>
          +250
        </button>
        <button className="btn water-btn" onClick={() => logWater(500)}>
          +500
        </button>
        <button
          className="btn ghost water-btn"
          onClick={() => total > 0 && logWater(-250)}
          aria-label="Undo 250 ml"
        >
          −250
        </button>
      </div>
    </div>
  );
}
