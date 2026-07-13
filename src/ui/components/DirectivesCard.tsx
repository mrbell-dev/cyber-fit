import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import {
  dayStatus,
  habitStreak,
  isScheduledOn,
  PRESETS,
  type DayKey,
  type Habit,
  type HabitLog,
} from "../../engine/index.ts";
import { useDayKey } from "../hooks.ts";
import { addHabit } from "../../db/repo.ts";
import { HabitCard } from "./HabitCard.tsx";
import { HabitEditor, type EditorSeed } from "./HabitEditor.tsx";

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

export function DirectivesCard() {
  const today = useDayKey();
  const [editorSeed, setEditorSeed] = useState<EditorSeed | null>(null);

  const TIME_RANK: Record<string, number> = { morning: 0, day: 1, evening: 2, anytime: 3 };
  const habits = useLiveQuery(async () => {
    const all = await db.habits.filter((h) => !h.archivedAt).sortBy("order");
    return all.sort(
      (a, b) => (TIME_RANK[a.timeOfDay ?? "anytime"] - TIME_RANK[b.timeOfDay ?? "anytime"]) || a.order - b.order,
    );
  }, []);
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray(), []);

  if (!habits || !habitLogs) return null;

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of habitLogs) {
    const list = logsByHabit.get(log.habitId);
    if (list) list.push(log);
    else logsByHabit.set(log.habitId, [log]);
  }

  return (
    <>
      {editorSeed && <HabitEditor seed={editorSeed} onClose={() => setEditorSeed(null)} />}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Directives — {today}</h2>
          <button className="card-add" aria-label="New directive" onClick={() => setEditorSeed({})}>
            +
          </button>
        </div>
        {habits.length === 0 ? (
          <>
            <p className="lore">
              Too much chrome, not enough ground truth — that's how you end up cyberpsycho.
              The protocol is simple: <strong>small daily syncs with your own wetware</strong>.
              Water. Movement. Reading. Knowing how you actually feel.
            </p>
            <button
              className="btn"
              onClick={async () => {
                for (const id of ["grounding", "stretch", "read"]) {
                  const p = PRESETS.find((x) => x.presetId === id)!;
                  await addHabit({
                    name: p.name, icon: p.icon, schedule: p.schedule,
                    area: p.area, timeOfDay: p.timeOfDay, presetId: p.presetId,
                  });
                }
              }}
            >
              Install grounding protocol
            </button>
            <p className="placeholder">// or browse the Directive Library in the SYSTEM tab</p>
          </>
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
    </>
  );
}
