import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db.ts";
import { PRESETS } from "../../engine/index.ts";
import { addHabit, currentDayKey, saveSettings } from "../../db/repo.ts";
import { useSettings } from "../hooks.ts";

const KEY = "onboarded";

/** First-run guided setup: difficulty, units, starter directives. Three taps
 *  and you're on the grid — everything is changeable later in System. */
export function Onboarding() {
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [starters, setStarters] = useState<string[]>(["grounding", "stretch", "read"]);

  const done = useLiveQuery(async () => Boolean((await db.kv.get(KEY))?.value), []);
  const anyHabits = useLiveQuery(async () => (await db.habits.count()) > 0, []);
  if (done === undefined || anyHabits === undefined || done || anyHabits) return null;

  const finish = async () => {
    for (const id of starters) {
      const p = PRESETS.find((x) => x.presetId === id)!;
      await addHabit({
        name: p.name, icon: p.icon, schedule: p.schedule,
        area: p.area, timeOfDay: p.timeOfDay, presetId: p.presetId,
      });
    }
    await db.kv.put({ key: KEY, value: true });
    // First run already greeted them — skip today's boot popup.
    await db.kv.put({ key: "lastBootDay", value: await currentDayKey() });
  };

  return (
    <div className="overlay">
      <div className="modal boot-modal" role="dialog" aria-modal="true" aria-label="First run setup">
        {step === 0 && (
          <>
            <p className="boot-greeting">Welcome to Night City.</p>
            <p className="boot-sub">
              This is your grounding protocol: small daily syncs — water, movement, reading,
              knowing how you actually feel. Everything stays on this device. No accounts,
              no tracking, no guilt mechanics. Ever.
            </p>
            <button className="btn" onClick={() => setStep(1)}>
              Begin calibration
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="boot-greeting">Pick your difficulty.</p>
            <p className="boot-sub">// only changes how fast levels come — never what you can do</p>
            <div className="chip-row">
              {(["easy", "standard", "hard"] as const).map((d) => (
                <button
                  key={d}
                  className={(settings.difficulty ?? "standard") === d ? "chip on" : "chip"}
                  onClick={() => saveSettings({ difficulty: d })}
                >
                  {d === "easy" ? "Easy" : d === "standard" ? "Standard" : "Full merc"}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {(["ml", "oz"] as const).map((u) => (
                <button
                  key={u}
                  className={(settings.waterUnit ?? "ml") === u ? "chip on" : "chip"}
                  onClick={() => saveSettings({ waterUnit: u })}
                >
                  water in {u}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setStep(2)}>
              Next
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <p className="boot-greeting">Starter directives.</p>
            <p className="boot-sub">// tap to toggle — add more later from the Codex in SYSTEM</p>
            <div className="chip-row">
              {PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.presetId}
                  className={starters.includes(p.presetId) ? "chip on" : "chip"}
                  onClick={() =>
                    setStarters(
                      starters.includes(p.presetId)
                        ? starters.filter((s) => s !== p.presetId)
                        : [...starters, p.presetId],
                    )
                  }
                >
                  {p.icon} {p.name.split(" — ")[0]}
                </button>
              ))}
            </div>
            <button className="btn" onClick={finish}>
              Jack in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
