import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { difficultyFactor, levelFromXp, type PlayerState } from "../../engine/index.ts";
import { useSettings } from "../hooks.ts";

export function XpBar() {
  const settings = useSettings();
  const [explain, setExplain] = useState<"streak" | "shield" | null>(null);
  const player = useLiveQuery(
    async () => (await db.kv.get("player"))?.value as PlayerState | undefined,
    [],
  );
  if (!player) return null;

  const { level, into, next } = levelFromXp(player.xp, difficultyFactor(settings));
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
            <button
              type="button"
              className="streak-chip chip-btn"
              title="Global streak"
              aria-expanded={explain === "streak"}
              onClick={() => setExplain(explain === "streak" ? null : "streak")}
            >
              ⚡{streak}d
            </button>
          )}
          {player.freezeTokens > 0 && (
            <button
              type="button"
              className="shield-chip chip-btn"
              title="Streak shields — auto-absorb a missed day"
              aria-expanded={explain === "shield"}
              onClick={() => setExplain(explain === "shield" ? null : "shield")}
            >
              ▣{player.freezeTokens}
            </button>
          )}
        </span>
      </div>
      {explain && (
        <p className="chip-explain" role="status">
          {explain === "streak"
            ? `⚡ Streak: ${streak} day${streak === 1 ? "" : "s"} in a row with at least one completed task. Miss a day and it resets — unless a shield absorbs it.`
            : `▣ Shields: you hold ${player.freezeTokens}. Each one silently covers a missed day so your streak survives. Earned as streak rewards.`}
        </p>
      )}
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
