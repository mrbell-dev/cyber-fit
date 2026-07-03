import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { AREAS, PRESETS } from "../../engine/index.ts";
import { addHabit } from "../../db/repo.ts";

const DISMISS_KEY = "dismissedSuggestions";

/** Finch-style gentle suggestions: surfaces up to two library directives from
 *  areas you haven't covered yet. Install in one tap, or dismiss forever. */
export function Suggestions() {
  const data = useLiveQuery(async () => {
    const [habits, dismissedRow] = await Promise.all([
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.kv.get(DISMISS_KEY),
    ]);
    return { habits, dismissed: ((dismissedRow?.value as string[]) ?? []) };
  }, []);

  if (!data || data.habits.length === 0) return null; // empty state has its own flow

  const installed = new Set(data.habits.map((h) => h.presetId).filter(Boolean));
  const coveredAreas = new Set(data.habits.map((h) => h.area).filter(Boolean));
  const dismissed = new Set(data.dismissed);

  const candidates = PRESETS
    .filter((p) => !installed.has(p.presetId) && !dismissed.has(p.presetId))
    .sort((a, b) => Number(coveredAreas.has(a.area)) - Number(coveredAreas.has(b.area)))
    .slice(0, 2);

  if (candidates.length === 0) return null;

  const dismiss = async (presetId: string) => {
    await db.kv.put({ key: DISMISS_KEY, value: [...data.dismissed, presetId] });
  };

  return (
    <div className="card">
      <h2 className="card-title">Suggested Protocols</h2>
      {candidates.map((p) => (
        <div className="row-item" key={p.presetId}>
          <span>
            {p.icon} {p.name}
            <span className="off-day-tag">
              {" "}· {AREAS.find((a) => a.id === p.area)?.name.toLowerCase()}
              {!coveredAreas.has(p.area) ? " — uncovered area" : ""}
            </span>
          </span>
          <span className="row-actions">
            <button
              className="link-btn"
              onClick={() =>
                addHabit({
                  name: p.name, icon: p.icon, schedule: p.schedule,
                  area: p.area, timeOfDay: p.timeOfDay, presetId: p.presetId,
                })
              }
            >
              add
            </button>
            <button className="link-btn" onClick={() => dismiss(p.presetId)}>
              not for me
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
