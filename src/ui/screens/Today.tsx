import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  dayStatus,
  habitStreak,
  isScheduledOn,
  type DayKey,
  type Habit,
  type HabitLog,
} from "../../engine/index.ts";
import { useDayKey, useSettings } from "../hooks.ts";
import { HabitCard } from "../components/HabitCard.tsx";
import { WaterGauge } from "../components/WaterGauge.tsx";

function habitView(habit: Habit, logs: HabitLog[], today: DayKey) {
  const byDay = new Map<DayKey, HabitLog[]>();
  for (const log of logs) {
    const list = byDay.get(log.dayKey);
    if (list) list.push(log);
    else byDay.set(log.dayKey, [log]);
  }
  const satisfied = new Set<DayKey>();
  const skipped = new Set<DayKey>();
  for (const [day, dayLogs] of byDay) {
    const s = dayStatus(habit, dayLogs);
    if (s.done) satisfied.add(day);
    if (s.skipped) skipped.add(day);
  }
  return {
    status: dayStatus(habit, byDay.get(today) ?? []),
    streak: habitStreak(habit, satisfied, skipped, today),
  };
}

export function Today() {
  const today = useDayKey();
  const settings = useSettings();

  const habits = useLiveQuery(
    () => db.habits.filter((h) => !h.archivedAt).sortBy("order"),
    [],
  );
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray(), []);
  const waterLogs = useLiveQuery(() => db.waterLogs.where({ dayKey: today }).toArray(), [today]);

  if (!habits || !habitLogs || !waterLogs) return null;

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of habitLogs) {
    const list = logsByHabit.get(log.habitId);
    if (list) list.push(log);
    else logsByHabit.set(log.habitId, [log]);
  }

  return (
    <section aria-label="Today">
      <div className="card">
        <h2 className="card-title">Directives — {today}</h2>
        {habits.length === 0 ? (
          <p className="placeholder">
            // no directives installed — add habits in the SYSTEM tab
          </p>
        ) : (
          habits.map((h) => {
            const { status, streak } = habitView(h, logsByHabit.get(h.id) ?? [], today);
            return (
              <HabitCard
                key={h.id}
                habit={h}
                status={status}
                streak={streak}
                today={today}
                scheduledToday={isScheduledOn(h, today)}
              />
            );
          })
        )}
      </div>

      <WaterGauge logs={waterLogs} goalMl={settings.waterGoalMl} />

      <div className="card">
        <h2 className="card-title">Vitals</h2>
        <p className="placeholder">// mood check-in boots in Phase 2</p>
      </div>
    </section>
  );
}
