import { AUGMENTS } from "../../engine/index.ts";
import { db } from "../../db/db.ts";
import { emitGrants } from "../toast.ts";
import { haptics } from "../haptics.ts";
import { testPush } from "../notify.ts";

/** Dev mode: playtest the juice without grinding for it. Toggled in Config. */
export function DevPanel() {
  const fake = (over: object) =>
    emitGrants([{ key: `dev-${Date.now()}`, dayKey: "dev", source: "habit", xp: 20, crit: false, ...over }]);

  return (
    <div className="card">
      <h2 className="card-title">Dev Mode — test bench</h2>
      <div className="theme-row">
        <button className="theme-swatch" onClick={() => fake({})}>
          fake XP toast
        </button>
        <button className="theme-swatch" onClick={() => fake({ crit: true, xp: 40 })}>
          fake CRIT
        </button>
        <button
          className="theme-swatch"
          onClick={() => fake({ drop: AUGMENTS[Math.floor(Math.random() * AUGMENTS.length)].id })}
        >
          fake shard drop
        </button>
        <button
          className="theme-swatch"
          onClick={async () => {
            await db.kv.delete("lastBootDay");
            location.reload();
          }}
        >
          replay boot popup
        </button>
        <button
          className="theme-swatch"
          onClick={async () => {
            await db.kv.delete("onboarded");
            location.reload();
          }}
        >
          replay first-run
        </button>
        <button className="theme-swatch" onClick={() => haptics.levelUp()}>
          haptic test
        </button>
        <button className="theme-swatch" onClick={() => testPush()}>
          test push ping
        </button>
      </div>
      <p className="placeholder">// fakes are visual only — no XP is written to the vault</p>
    </div>
  );
}
