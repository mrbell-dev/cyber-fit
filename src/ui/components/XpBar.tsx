import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { levelFromXp, type PlayerState } from "../../engine/index.ts";

export function XpBar() {
  const player = useLiveQuery(
    async () => (await db.kv.get("player"))?.value as PlayerState | undefined,
    [],
  );
  if (!player) return null;

  const { level, into, next } = levelFromXp(player.xp);
  const pct = Math.round((into / next) * 100);
  const streak = player.globalStreak.current;

  return (
    <div className="xp-panel">
      <div className="xp-row">
        <span className="xp-level">
          LVL {level} <span className="xp-firmware">// FIRMWARE v{level}.{Math.floor(pct / 10)}</span>
        </span>
        <span className="xp-badges">
          {streak > 0 && (
            <span className="streak-chip" title="Global streak">
              ⚡{streak}d
            </span>
          )}
          {player.freezeTokens > 0 && (
            <span className="shield-chip" title="Streak shields — auto-absorb a missed day">
              ▣{player.freezeTokens}
            </span>
          )}
        </span>
      </div>
      <div
        className="xp-bar"
        role="progressbar"
        aria-valuenow={into}
        aria-valuemin={0}
        aria-valuemax={next}
        aria-label={`Level ${level}, ${into} of ${next} XP`}
      >
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
