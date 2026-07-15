// Trend views (eval rec #4 — the #1 care-team ask): mood over 30/90 days and
// PHQ-9/GAD-7 scores over time. Read-only telemetry; no XP, no streaks —
// charting your mood should never feel like a directive.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  moodTrend,
  screenerTrend,
  SCREENERS,
  scoreBand,
  type DayKey,
  type TrendPoint,
} from "../../engine/index.ts";
import { useDayKey } from "../hooks.ts";

const W = 280;
const H = 64;
const PAD = 4;

/** Minimal SVG line — days map to x by date position (gaps stay gaps),
 *  values map to y within the given fixed scale. */
function Sparkline({
  points,
  min,
  max,
  from,
  to,
  color,
  label,
}: {
  points: TrendPoint[];
  min: number;
  max: number;
  from: DayKey;
  to: DayKey;
  color: string;
  label: string;
}) {
  const span = Date.parse(to) - Date.parse(from) || 1;
  const x = (d: DayKey) => PAD + ((Date.parse(d) - Date.parse(from)) / span) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
  const pts = points.map((p) => `${x(p.dayKey).toFixed(1)},${y(p.value).toFixed(1)}`);

  return (
    <svg
      className="trend-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {points.length > 1 && (
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" />
      )}
      {points.map((p, i) => (
        <circle key={p.dayKey} cx={x(p.dayKey)} cy={y(p.value)} r={i === points.length - 1 ? 2.5 : 1.5} fill={color} />
      ))}
    </svg>
  );
}

export function TrendCharts() {
  const today = useDayKey();
  const [win, setWin] = useState<30 | 90>(30);

  const data = useLiveQuery(async () => {
    const [moodLogs, screenings] = await Promise.all([
      db.moodLogs.toArray(),
      db.screenings.toArray(),
    ]);
    return { moodLogs, screenings };
  }, []);

  if (!data) return null;

  const moodPts = moodTrend(data.moodLogs, today, win);
  const from = new Date(Date.parse(today) - (win - 1) * 86400000).toISOString().slice(0, 10);
  const screeners = SCREENERS.map((def) => ({
    def,
    pts: screenerTrend(data.screenings, def.tool).filter((p) => p.dayKey >= from),
  })).filter((s) => s.pts.length > 0);

  // Nothing to chart yet — don't render an empty frame that begs for data.
  if (moodPts.length < 2 && screeners.every((s) => s.pts.length < 2)) return null;

  return (
    <div className="card">
      <h2 className="card-title">Trend Lines</h2>
      <div className="chip-row" role="group" aria-label="Trend window">
        {([30, 90] as const).map((d) => (
          <button
            key={d}
            className={win === d ? "chip on" : "chip"}
            aria-pressed={win === d}
            onClick={() => setWin(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {moodPts.length >= 2 && (
        <div className="trend-block">
          <div className="trend-head">
            <span className="trend-label">Mood (1–5)</span>
            <span className="trend-latest">
              latest {moodPts[moodPts.length - 1].value.toFixed(1)}
            </span>
          </div>
          <Sparkline
            points={moodPts}
            min={1}
            max={5}
            from={from}
            to={today}
            color="var(--accent-2)"
            label={`Mood trend, last ${win} days, ${moodPts.length} days with readings`}
          />
        </div>
      )}

      {screeners.map(({ def, pts }) =>
        pts.length >= 2 ? (
          <div className="trend-block" key={def.tool}>
            <div className="trend-head">
              <span className="trend-label">{def.tool === "phq9" ? "PHQ-9" : "GAD-7"} (0–{def.maxScore})</span>
              <span className="trend-latest">
                latest {pts[pts.length - 1].value} · {scoreBand(def, pts[pts.length - 1].value)}
              </span>
            </div>
            <Sparkline
              points={pts}
              min={0}
              max={def.maxScore}
              from={from}
              to={today}
              color="var(--accent)"
              label={`${def.tool === "phq9" ? "PHQ-9" : "GAD-7"} scores, last ${win} days`}
            />
          </div>
        ) : null,
      )}
      <p className="placeholder">
        // lower is better on screeners; higher is better on mood. gaps are
        gaps — days without readings aren't drawn as zeros
      </p>
    </div>
  );
}
