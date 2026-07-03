import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { diffDays, type DayKey } from "../../engine/index.ts";

const BOOT_KEY = "lastBootDay";

function greetingFor(hour: number): string {
  if (hour < 12) return "Rise and shine, Night City.";
  if (hour < 17) return "Back on the grid, choom.";
  if (hour < 22) return "Evening shift, edgerunner.";
  return "Burning the midnight neon.";
}

/** Most recent day with any log at all (null = brand new user). */
async function lastActiveDay(): Promise<DayKey | null> {
  const tables = [
    db.habitLogs, db.waterLogs, db.moodLogs, db.workoutLogs,
    db.readingLogs, db.highlightLogs, db.bodyLogs,
  ] as const;
  let latest: DayKey | null = null;
  for (const t of tables) {
    const row = await t.orderBy("dayKey").last();
    if (row && (!latest || row.dayKey > latest)) latest = row.dayKey;
  }
  return latest;
}

/**
 * First-open-of-the-day arrival. Doctrine (CLAUDE.md rule 6): a returning
 * user after a gap gets a warm welcome-back — never a count of missed days
 * or notifications. Morning/afternoon greet as a full-screen modal
 * (gravedigger-style); evening/late stays a quiet inline card.
 */
export function DailyBoot({ today }: { today: DayKey }) {
  const info = useLiveQuery(async () => {
    const lastBoot = ((await db.kv.get(BOOT_KEY))?.value as string | undefined) ?? "";
    const onboarded = Boolean((await db.kv.get("onboarded"))?.value);
    const habitCount = await db.habits.count();
    return { lastBoot, onboarded, habitCount, lastActive: await lastActiveDay() };
  }, [today]);

  if (!info || info.lastBoot === today) return null;
  // Brand-new user: onboarding owns the screen — don't stack a boot modal under it.
  if (!info.onboarded && info.habitCount === 0) return null;

  const dismiss = () => db.kv.put({ key: BOOT_KEY, value: today });
  const gapDays = info.lastActive ? diffDays(info.lastActive, today) : 0;
  const hour = new Date().getHours();

  // Welcome back after a gap — warmth only, zero arithmetic shown.
  if (gapDays >= 2) {
    return (
      <div className="overlay">
        <div className="modal boot-modal" role="dialog" aria-modal="true" aria-label="Welcome back">
          <p className="boot-greeting">Good to see you, choom.</p>
          <p className="boot-sub">
            The grid held your place. Shields did their job. Ready for a new gig?
          </p>
          <button className="btn" onClick={dismiss} autoFocus>
            Jack in
          </button>
        </div>
      </div>
    );
  }

  // Morning / afternoon → full-screen boot modal.
  if (hour < 17) {
    return (
      <div className="overlay">
        <div className="modal boot-modal" role="dialog" aria-modal="true" aria-label="Daily boot">
          <p className="boot-greeting">{greetingFor(hour)}</p>
          <p className="boot-sub">// new day on the grid — {today}</p>
          <button className="btn" onClick={dismiss} autoFocus>
            Jack in
          </button>
        </div>
      </div>
    );
  }

  // Evening / late → quiet inline card.
  return (
    <div className="boot-card" role="status">
      <p className="boot-greeting">{greetingFor(hour)}</p>
      <p className="boot-sub">// new day on the grid — {today}</p>
      <button className="btn" onClick={dismiss}>
        Jack in
      </button>
    </div>
  );
}
