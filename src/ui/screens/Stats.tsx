import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  addDays,
  daySetStreak,
  learningDays,
  levelFromXp,
  readingDays,
  waterTotal,
  type PlayerState,
} from "../../engine/index.ts";
import { useDayKey, useSettings } from "../hooks.ts";

const GRID_DAYS = 28;

export function Stats() {
  const today = useDayKey();
  const settings = useSettings();

  const data = useLiveQuery(async () => {
    const [habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs, playerRow] =
      await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.waterLogs.toArray(),
        db.moodLogs.toArray(),
        db.workoutLogs.toArray(),
        db.readingLogs.toArray(),
        db.kv.get("player"),
      ]);
    return { habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingLogs,
      player: playerRow?.value as PlayerState | undefined };
  }, []);

  if (!data) return null;
  const { player } = data;

  // Activity grid: any positive log on that day.
  const active = new Set<string>();
  for (const l of data.habitLogs) if (l.kind === "done" && l.amount > 0) active.add(l.dayKey);
  for (const l of data.waterLogs) if (l.ml > 0) active.add(l.dayKey);
  for (const l of data.moodLogs) active.add(l.dayKey);
  for (const l of data.workoutLogs) active.add(l.dayKey);
  for (const l of data.readingLogs) active.add(l.dayKey);

  const gridDays = Array.from({ length: GRID_DAYS }, (_, i) => addDays(today, i - (GRID_DAYS - 1)));

  // Water bars, last 7 days.
  const waterByDay = new Map<string, number>();
  for (const l of data.waterLogs) {
    waterByDay.set(l.dayKey, (waterByDay.get(l.dayKey) ?? 0) + l.ml);
  }
  const waterDaysList = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const logs = data.waterLogs.filter((l) => l.dayKey === day);
    return { day, total: waterTotal(logs) };
  });
  const maxWater = Math.max(settings.waterGoalMl, ...waterDaysList.map((d) => d.total));

  const readStreak = daySetStreak(readingDays(data.readingLogs), today);
  const learnStreak = daySetStreak(
    learningDays(data.habits, data.habitLogs, data.readingLogs),
    today,
  );

  const lv = player ? levelFromXp(player.xp) : { level: 0, into: 0, next: 100 };

  return (
    <section aria-label="Stats">
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
          <div className="stat-tile">
            <span className="stat-num">▣{player?.freezeTokens ?? 0}</span>
            <span className="stat-label">Shields</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">📖{readStreak}</span>
            <span className="stat-label">Reading</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">🧠{learnStreak}</span>
            <span className="stat-label">Learning</span>
          </div>
          <div className="stat-tile">
            <span className="stat-num">{data.workoutLogs.length}</span>
            <span className="stat-label">Workouts</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Uptime — last {GRID_DAYS} days</h2>
        <div className="day-grid" role="img" aria-label={`Activity for the last ${GRID_DAYS} days`}>
          {gridDays.map((day) => (
            <span
              key={day}
              className={active.has(day) ? "day-dot on" : "day-dot"}
              title={day}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Hydration — last 7 days</h2>
        <div className="water-week" role="img" aria-label="Water intake, last 7 days">
          {waterDaysList.map(({ day, total }) => (
            <div className="water-day" key={day}>
              <div
                className={total >= settings.waterGoalMl ? "water-col met" : "water-col"}
                style={{ height: `${Math.max(4, Math.round((total / maxWater) * 72))}px` }}
                title={`${day}: ${total} ml`}
              />
              <span className="water-day-label">{day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
