import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import type { DayKey, Gig } from "../../engine/index.ts";
import { retireGig } from "../../db/repo.ts";

const MIGRATED_KEY = "gigMigratedDay";
const BOOT_KEY = "lastBootDay";

/**
 * The bullet-journal migration ritual. On the first open of a new day (after
 * the boot greeting), any gigs still open from prior days come up for review:
 * check what still matters to pull forward, let the rest go. The friction is
 * the feature — re-choosing keeps the board honest instead of a stale pile.
 * Doctrine: forgiving framing, escape hatches, shows once per day.
 */
export function GigMigration({ today }: { today: DayKey }) {
  const info = useLiveQuery(async () => {
    const migrated = ((await db.kv.get(MIGRATED_KEY))?.value as string | undefined) ?? "";
    const lastBoot = ((await db.kv.get(BOOT_KEY))?.value as string | undefined) ?? "";
    const all = await db.gigs.toArray();
    const stale = all.filter((g) => !g.doneTs && !g.retiredDay && g.createdDay < today);
    return { migrated, lastBoot, stale };
  }, [today]);

  // Carry EVERYTHING by default — unchecking is an explicit "let it go".
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  if (!info) return null;
  // Wait until the boot greeting is dismissed (don't stack two modals), and
  // only run once per day, and only when there's actually something to migrate.
  if (info.lastBoot !== today) return null;
  if (info.migrated === today) return null;
  if (info.stale.length === 0) return null;

  const toggle = (id: string) =>
    setDropped((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const finish = async (retire: Gig[]) => {
    for (const g of retire) await retireGig(g.id);
    await db.kv.put({ key: MIGRATED_KEY, value: today });
  };

  return (
    <div className="overlay">
      <div className="modal boot-modal" role="dialog" aria-modal="true" aria-label="Carry over gigs">
        <p className="boot-greeting">Fresh sheet, choom.</p>
        <p className="boot-sub">
          Still open from before. Pull over what still matters — let the rest go, no guilt.
        </p>
        {info.stale.map((g) => (
          <label className="check-label migrate-row" key={g.id}>
            <input
              type="checkbox"
              checked={!dropped.has(g.id)}
              onChange={() => toggle(g.id)}
            />
            <span className={dropped.has(g.id) ? "gig-text let-go" : "gig-text"}>{g.text}</span>
            <span className="off-day-tag">{dropped.has(g.id) ? "let go" : "carry over"}</span>
          </label>
        ))}
        <button
          className="btn"
          onClick={() => finish(info.stale.filter((g) => dropped.has(g.id)))}
          autoFocus
        >
          Carry {info.stale.length - dropped.size} forward
        </button>
        <button className="btn ghost" onClick={() => finish([])}>
          Keep them all for now
        </button>
      </div>
    </div>
  );
}
