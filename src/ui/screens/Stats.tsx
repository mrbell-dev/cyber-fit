import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  addDays,
  daySetStreak,
  difficultyFactor,
  goalProgress,
  learningDays,
  levelFromXp,
  readingDays,
  waterTotal,
  type DayKey,
  type PlayerState,
} from "../../engine/index.ts";
import { useState } from "react";
import { useDayKey, useSettings } from "../hooks.ts";
import { HighlightReel } from "../components/Highlight.tsx";
import { CareTeamExport } from "../components/CareTeamExport.tsx";
import { TrendCharts } from "../components/TrendCharts.tsx";

const GRID_DAYS = 28; // 14-wide rows, GitHub-style intensity; tap a day for detail

interface WeekData {
  habitLogs: import("../../engine/index.ts").HabitLog[];
  waterLogs: import("../../engine/index.ts").WaterLog[];
  moodLogs: import("../../engine/index.ts").MoodLog[];
  workoutLogs: import("../../engine/index.ts").WorkoutLog[];
  readingLogs: import("../../engine/index.ts").ReadingLog[];
  highlightLogs: import("../../engine/index.ts").HighlightLog[];
}

/** Last-7-days summary, framed positively — a report, never a scolding. */
function WeeklyReport({
  today,
  data,
  waterGoalMl,
  shields,
}: {
  today: string;
  data: WeekData;
  waterGoalMl: number;
  shields: number;
}) {
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const inWeek = <T extends { dayKey: string }>(rows: T[]) => rows.filter((r) => week.has(r.dayKey));

  const habitDone = inWeek(data.habitLogs).filter((l) => l.kind === "done" && l.amount > 0).length;
  const waterDays = [...week].filter(
    (d) => waterTotal(data.waterLogs.filter((l) => l.dayKey === d)) >= waterGoalMl,
  ).length;
  const workouts = inWeek(data.workoutLogs).length;
  const sessions = inWeek(data.readingLogs);
  const notes = sessions.filter((s) => s.note).length;
  const moods = inWeek(data.moodLogs);
  const moodAvg = moods.length
    ? (moods.reduce((s, m) => s + m.rating, 0) / moods.length).toFixed(1)
    : null;

  const lines: string[] = [];
  if (habitDone > 0) lines.push(`${habitDone} directive sync${habitDone === 1 ? "" : "s"} executed`);
  if (waterDays > 0) lines.push(`hydration goal hit on ${waterDays}/7 days`);
  if (workouts > 0) lines.push(`${workouts} training session${workouts === 1 ? "" : "s"} — chrome maintained`);
  if (sessions.length > 0)
    lines.push(`${sessions.length} reading session${sessions.length === 1 ? "" : "s"}${notes ? ` (${notes} with reflections)` : ""}`);
  if (moodAvg) lines.push(`mood check-ins averaged ${moodAvg}/5 across ${moods.length} check-in${moods.length === 1 ? "" : "s"}`);
  const highlights = inWeek(data.highlightLogs).length;
  if (highlights > 0) lines.push(`${highlights} highlight${highlights === 1 ? "" : "s"} captured — the week had good frames`);
  if (shields > 0) lines.push(`${shields} shield${shields === 1 ? "" : "s"} banked against missed days`);
  if (lines.length === 0) lines.push("quiet week — the grid held your place. Log anything to restart the feed.");

  return (
    <div className="card">
      <h2 className="card-title">System Report — last 7 days</h2>
      {lines.map((l) => (
        <p className="report-line" key={l}>
          <span aria-hidden="true">▸ </span>
          {l}
        </p>
      ))}
    </div>
  );
}

/** Read-only glance at active goals — management lives in GRIND ▸ GOALS. */
function ObjectivesStrip({ today }: { today: DayKey }) {
  const data = useLiveQuery(async () => {
    const [goals, habitLogs, readingLogs, workoutLogs, goalLogs] = await Promise.all([
      db.goals.filter((g) => !g.archivedAt).sortBy("order"),
      db.habitLogs.toArray(),
      db.readingLogs.toArray(),
      db.workoutLogs.toArray(),
      db.goalLogs.toArray(),
    ]);
    return { goals, tables: { habitLogs, readingLogs, workoutLogs, goalLogs } };
  }, []);

  if (!data || data.goals.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Objectives</h2>
      {data.goals.map((g) => {
        const p = goalProgress(g, data.tables, today);
        const pct = p.target ? Math.min(100, (p.value / p.target) * 100) : 0;
        const done = p.target ? p.value >= p.target : false;
        return (
          <div key={g.id} className="goal-row" aria-label={`Goal ${g.name}`}>
            <div className="goal-row-top">
              <span className="goal-name">
                {g.icon ? `${g.icon} ` : ""}
                {g.name}
              </span>
              <span className={done ? "goal-chip done" : `goal-chip ${p.pace}`}>
                {done ? "✔ done" : p.openEnded ? `${p.value}` : `${Math.round(pct)}%`}
              </span>
            </div>
            {!p.openEnded && (
              <div className="goal-bar" aria-hidden="true">
                <div className="goal-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
      <p className="placeholder">// manage objectives in GRIND ▸ GOALS</p>
    </div>
  );
}

function intensityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function Stats() {
  const today = useDayKey();
  const settings = useSettings();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [shieldInfo, setShieldInfo] = useState(false);

  const data = useLiveQuery(async () => {
    const [habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs, playerRow] =
      await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.waterLogs.toArray(),
        db.moodLogs.toArray(),
        db.workoutLogs.toArray(),
        db.readingLogs.toArray(),
        db.highlightLogs.toArray(),
        db.kv.get("player"),
      ]);
    return { habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, highlightLogs,
      player: playerRow?.value as PlayerState | undefined };
  }, []);

  if (!data) return null;
  const { player } = data;

  // Activity intensity per day: every positive log is one "sync".
  const countByDay = new Map<string, number>();
  const bump = (day: string) => countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  for (const l of data.habitLogs) if (l.kind === "done" && l.amount > 0) bump(l.dayKey);
  for (const l of data.waterLogs) if (l.ml > 0) bump(l.dayKey);
  for (const l of data.moodLogs) bump(l.dayKey);
  for (const l of data.workoutLogs) bump(l.dayKey);
  for (const l of data.readingLogs) bump(l.dayKey);
  for (const l of data.highlightLogs) bump(l.dayKey);

  const gridDays = Array.from({ length: GRID_DAYS }, (_, i) => addDays(today, i - (GRID_DAYS - 1)));

  const readStreak = daySetStreak(readingDays(data.readingLogs), today);
  const learnStreak = daySetStreak(
    learningDays(data.habits, data.habitLogs, data.readingLogs),
    today,
  );

  const lv = player
    ? levelFromXp(player.xp, difficultyFactor(settings))
    : { level: 0, into: 0, next: 100 };

  return (
    <section aria-label="Stats">
      <ObjectivesStrip today={today} />

      <div className="card">
        <h2 className="card-title">Telemetry (Local Only)</h2>
        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="stat-num">{lv.level}</span>
            <span className="stat-label">Level</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">{player?.xp ?? 0}</span>
            <span className="stat-label">Total XP</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">⚡{player?.globalStreak.current ?? 0}</span>
            <span className="stat-label">Streak</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">{player?.globalStreak.best ?? 0}</span>
            <span className="stat-label">Best</span>
          </div>
          <button
            className={`stat-tile tappable${shieldInfo ? " on" : ""}`}
            onClick={() => setShieldInfo(!shieldInfo)}
            aria-expanded={shieldInfo}
          >
            <span className="stat-num">▣{player?.freezeTokens ?? 0}</span>
            <span className="stat-label">Shields <span className="info-dot">ⓘ</span></span>
          </button>
          {(data.readingLogs.length > 0 || readStreak > 0) && (
            <div className="stat-tile">
              <span className="stat-num">📖{readStreak}</span>
              <span className="stat-label">Reading</span>
            </div>
          )}
          {(learnStreak > 0 || data.habits.some((h) => h.domain === "learning")) && (
            <div className="stat-tile">
              <span className="stat-num">🧠{learnStreak}</span>
              <span className="stat-label">Learning</span>
            </div>
          )}
          {data.workoutLogs.length > 0 && (
            <div className="stat-tile">
              <span className="stat-num">{data.workoutLogs.length}</span>
              <span className="stat-label">Workouts</span>
            </div>
          )}
        </div>
        {shieldInfo && (
          <p className="placeholder">
            // ▣ SHIELDS: bank one automatically every 5 active days (max 3). miss a
            day and a shield absorbs it silently — your streak holds, and you never see
            a "streak lost". run out and the streak reboots to zero (a reboot, not a
            failure). full rules live in the Field Manual, over in SYSTEM. untracked
            domains hide their tiles — this screen shapes itself to you
          </p>
        )}
      </div>

      <WeeklyReport
        today={today}
        data={data}
        waterGoalMl={settings.waterGoalMl}
        shields={player?.freezeTokens ?? 0}
      />

      <div className="card">
        <h2 className="card-title">Uptime — last {GRID_DAYS} days</h2>
        <div className="day-grid" role="img" aria-label={`Activity for the last ${GRID_DAYS} days`}>
          {gridDays.map((day) => {
            const n = countByDay.get(day) ?? 0;
            const lvl = intensityLevel(n);
            return (
              <button
                key={day}
                className={`day-dot${lvl ? ` l${lvl}` : ""}${selectedDay === day ? " sel" : ""}`}
                title={`${day}: ${n} sync${n === 1 ? "" : "s"}`}
                aria-label={`${day}: ${n} syncs`}
                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              />
            );
          })}
        </div>
        {selectedDay && (
          <p className="placeholder">
            // {selectedDay}:{" "}
            {[
              [data.habitLogs.filter((l) => l.dayKey === selectedDay && l.kind === "done" && l.amount > 0).length, "directive syncs"],
              [data.waterLogs.filter((l) => l.dayKey === selectedDay && l.ml > 0).length, "water logs"],
              [data.moodLogs.filter((l) => l.dayKey === selectedDay).length, "vitals"],
              [data.workoutLogs.filter((l) => l.dayKey === selectedDay).length, "workouts"],
              [data.readingLogs.filter((l) => l.dayKey === selectedDay).length, "reading"],
              [data.highlightLogs.filter((l) => l.dayKey === selectedDay).length, "highlights"],
            ]
              .filter(([n]) => (n as number) > 0)
              .map(([n, label]) => `${n} ${label}`)
              .join(" · ") || "quiet day — the grid held your place"}
          </p>
        )}
        <div className="grid-legend" aria-hidden="true">
          less
          <span className="day-dot" />
          <span className="day-dot l1" />
          <span className="day-dot l2" />
          <span className="day-dot l3" />
          <span className="day-dot l4" />
          more
        </div>
      </div>

      <TrendCharts />

      <CareTeamExport />

      <HighlightReel />
    </section>
  );
}
