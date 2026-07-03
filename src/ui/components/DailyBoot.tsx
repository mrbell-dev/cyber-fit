import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey } from "../../engine/index.ts";

const BOOT_KEY = "lastBootDay";

function greetingFor(hour: number): string {
  if (hour < 12) return "Rise and shine, Night City.";
  if (hour < 17) return "Back on the grid, choom.";
  if (hour < 22) return "Evening shift, edgerunner.";
  return "Burning the midnight neon.";
}

/** First-open-of-the-day boot screen — any hour, greeted accordingly. */
export function DailyBoot({ today }: { today: DayKey }) {
  const lastBoot = useLiveQuery(
    async () => ((await db.kv.get(BOOT_KEY))?.value as string | undefined) ?? "",
    [],
  );

  if (lastBoot === undefined || lastBoot === today) return null;

  return (
    <div className="boot-card" role="status">
      <p className="boot-greeting">{greetingFor(new Date().getHours())}</p>
      <p className="boot-sub">// new day on the grid — {today}</p>
      <button className="btn" onClick={() => db.kv.put({ key: BOOT_KEY, value: today })}>
        Jack in
      </button>
    </div>
  );
}
