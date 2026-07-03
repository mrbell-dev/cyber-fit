import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { globalStreakWithShields, rebuild, type LogBundle } from "./rebuild.ts";
import { BASE_XP, DAILY_CAP, FREEZE_CAP } from "./rewards.ts";
import { DEFAULT_SETTINGS, type Habit, type HabitLog, type MoodLog, type WaterLog } from "./types.ts";
import { addDays } from "./time.ts";

const TODAY = "2026-07-02";

const habit: Habit = {
  id: "h1", name: "Test", icon: "⚡", schedule: { kind: "daily" },
  domain: "general", target: 1, createdAt: 0, order: 0,
};

function bundle(partial: Partial<LogBundle>): LogBundle {
  return {
    habits: [habit],
    habitLogs: [],
    waterLogs: [],
    moodLogs: [],
    workoutLogs: [],
    readingLogs: [],
    highlightLogs: [],
    bodyLogs: [],
    journalLogs: [],
    gigs: [],
    bioReadings: [],
    settings: DEFAULT_SETTINGS,
    today: TODAY,
    ...partial,
  };
}

const hlog = (id: string, dayKey: string, ts: number, amount = 1): HabitLog => ({
  id, habitId: "h1", dayKey, ts, amount, kind: "done",
});
const wlog = (id: string, dayKey: string, ts: number, ml: number): WaterLog => ({ id, dayKey, ts, ml });
const mlog = (id: string, dayKey: string, ts: number): MoodLog => ({ id, dayKey, ts, rating: 3 });

describe("rebuild — XP grants", () => {
  it("habit completion + first-of-day bonus", () => {
    const { state, grants } = rebuild(bundle({ habitLogs: [hlog("a", TODAY, 100)] }));
    const sources = grants.map((g) => g.source).sort();
    expect(sources).toEqual(["daily", "habit"]);
    expect(state.xp).toBeGreaterThanOrEqual(BASE_XP.habit + BASE_XP.daily);
  });

  it("water grants only when the goal is crossed", () => {
    const under = rebuild(bundle({ waterLogs: [wlog("w1", TODAY, 100, 1999)] }));
    expect(under.grants.filter((g) => g.source === "water")).toHaveLength(0);

    const over = rebuild(bundle({
      waterLogs: [wlog("w1", TODAY, 100, 1500), wlog("w2", TODAY, 200, 500)],
    }));
    const waterGrants = over.grants.filter((g) => g.source === "water");
    expect(waterGrants).toHaveLength(1);
    expect(waterGrants[0].key).toBe("water:w2"); // the crossing log
  });

  it("combo fires when habit + water + mood all land in one day", () => {
    const { grants } = rebuild(bundle({
      habitLogs: [hlog("a", TODAY, 100)],
      waterLogs: [wlog("w", TODAY, 200, 2000)],
      moodLogs: [mlog("m", TODAY, 300)],
    }));
    expect(grants.some((g) => g.source === "combo")).toBe(true);
  });

  it("a habit completing twice in a day earns once", () => {
    const { grants } = rebuild(bundle({
      habitLogs: [hlog("a", TODAY, 100), hlog("b", TODAY, 200)],
    }));
    expect(grants.filter((g) => g.source === "habit")).toHaveLength(1);
  });

  it("is deterministic", () => {
    const b = bundle({
      habitLogs: [hlog("a", TODAY, 100)],
      waterLogs: [wlog("w", TODAY, 200, 2000)],
      moodLogs: [mlog("m", TODAY, 300)],
    });
    expect(rebuild(b)).toEqual(rebuild(b));
  });
});

describe("rebuild — weigh-in XP (monthly cadence)", () => {
  const body = (id: string, dayKey: string, ts: number) => ({
    id, dayKey, ts, weight: 200, unit: "lbs" as const,
  });

  it("first weigh-in earns; one 5 days later doesn't; one 25 days later does", () => {
    const { grants } = rebuild(bundle({
      bodyLogs: [
        body("w1", addDays(TODAY, -30), 100),
        body("w2", addDays(TODAY, -25), 200), // too soon after w1
        body("w3", addDays(TODAY, -5), 300),  // 25 days after w1 → earns
      ],
    }));
    const keys = grants.filter((g) => g.source === "weighin").map((g) => g.key);
    expect(keys).toEqual(["weighin:w1", "weighin:w3"]);
  });

  it("daily scale-watching earns exactly once on monthly cadence", () => {
    const logs = Array.from({ length: 10 }, (_, i) => body(`d${i}`, addDays(TODAY, -9 + i), i));
    const { grants } = rebuild(bundle({ bodyLogs: logs }));
    expect(grants.filter((g) => g.source === "weighin")).toHaveLength(1);
  });

  it("daily cadence rewards every day; weekly rewards ~weekly", () => {
    const logs = Array.from({ length: 10 }, (_, i) => body(`d${i}`, addDays(TODAY, -9 + i), i));
    const daily = rebuild(bundle({
      bodyLogs: logs,
      settings: { ...DEFAULT_SETTINGS, weighinCadence: "daily" },
    }));
    expect(daily.grants.filter((g) => g.source === "weighin")).toHaveLength(10);

    const weekly = rebuild(bundle({
      bodyLogs: logs,
      settings: { ...DEFAULT_SETTINGS, weighinCadence: "weekly" },
    }));
    expect(weekly.grants.filter((g) => g.source === "weighin")).toHaveLength(2); // day 0 + day 5
  });
});

describe("rebuild — charge weighting + difficulty + new sources", () => {
  it("a 5⚡ habit earns 5× base (before crit)", () => {
    const boss = { ...habit, id: "boss", charge: 5 };
    const { grants } = rebuild(bundle({
      habits: [boss],
      habitLogs: [{ id: "a", habitId: "boss", dayKey: TODAY, ts: 100, amount: 1, kind: "done" }],
    }));
    const g = grants.find((x) => x.source === "habit")!;
    expect(g.xp === 50 || g.xp === 100).toBe(true); // ×5, or crit-doubled
  });

  it("difficulty changes level for the same XP", () => {
    const logs = { habitLogs: [hlog("a", TODAY, 100)], moodLogs: [mlog("m", TODAY, 300)] };
    const easy = rebuild(bundle({ ...logs, settings: { ...DEFAULT_SETTINGS, difficulty: "easy" } }));
    const hard = rebuild(bundle({ ...logs, settings: { ...DEFAULT_SETTINGS, difficulty: "hard" } }));
    expect(easy.state.xp).toBe(hard.state.xp);
    expect(easy.state.level).toBeGreaterThanOrEqual(hard.state.level);
  });

  it("gigs earn on completion day; journal caps at 1/day; bio caps at 4/day", () => {
    const { grants } = rebuild(bundle({
      gigs: [
        { id: "g1", text: "call clinic", createdDay: addDays(TODAY, -1), ts: 1, doneTs: 500, doneDay: TODAY },
        { id: "g2", text: "not done", createdDay: TODAY, ts: 2 },
      ],
      journalLogs: [
        { id: "j1", dayKey: TODAY, ts: 100, text: "brain dump" },
        { id: "j2", dayKey: TODAY, ts: 200, text: "second dump" },
      ],
      bioReadings: Array.from({ length: 6 }, (_, i) => ({
        id: `b${i}`, metricId: "bp", dayKey: TODAY, ts: 300 + i, value: "120/80",
      })),
    }));
    expect(grants.filter((g) => g.source === "gig")).toHaveLength(1);
    expect(grants.filter((g) => g.source === "journal")).toHaveLength(1);
    expect(grants.filter((g) => g.source === "bio")).toHaveLength(4);
  });
});

describe("rebuild — highlight XP", () => {
  it("first highlight of the day earns; repeats don't", () => {
    const { grants } = rebuild(bundle({
      highlightLogs: [
        { id: "hl1", dayKey: TODAY, ts: 100, text: "saw a lizard on the patio" },
        { id: "hl2", dayKey: TODAY, ts: 200, text: "good coffee" },
      ],
    }));
    expect(grants.filter((g) => g.source === "highlight")).toHaveLength(1);
    expect(grants.find((g) => g.source === "highlight")!.key).toBe("highlight:hl1");
  });
});

describe("globalStreakWithShields", () => {
  const days = (...offsets: number[]) => new Set(offsets.map((o) => addDays(TODAY, o)));

  it("simple run", () => {
    expect(globalStreakWithShields(days(-2, -1, 0), TODAY)).toMatchObject({ current: 3 });
  });

  it("today not yet active never breaks", () => {
    expect(globalStreakWithShields(days(-2, -1), TODAY).current).toBe(2);
  });

  it("no shield → reboot", () => {
    // 3 active, gap, 1 active — never banked a shield (needs 5).
    expect(globalStreakWithShields(days(-4, -3, -2, 0), TODAY).current).toBe(1);
  });

  it("shield absorbs a gap after a 5-day run", () => {
    // 5 active days bank a shield; day -1 missed; today active.
    const active = days(-6, -5, -4, -3, -2, 0);
    const r = globalStreakWithShields(active, TODAY);
    expect(r.current).toBe(6); // preserved through the gap
    expect(r.freezeTokens).toBe(0); // spent
  });

  it("tokens cap at FREEZE_CAP", () => {
    const active = new Set<string>();
    for (let i = 0; i < 40; i++) active.add(addDays(TODAY, -i));
    expect(globalStreakWithShields(active, TODAY).freezeTokens).toBe(FREEZE_CAP);
  });
});

describe("property tests", () => {
  const arbDay = fc.integer({ min: -30, max: 0 }).map((o) => addDays(TODAY, o));

  it("rebuild is deterministic and respects per-source daily caps", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), dayKey: arbDay, ts: fc.nat(10_000) }), { maxLength: 60 }),
        fc.array(fc.record({ id: fc.uuid(), dayKey: arbDay, ts: fc.nat(10_000), ml: fc.integer({ min: -500, max: 2500 }) }), { maxLength: 40 }),
        (hs, ws) => {
          const b = bundle({
            habitLogs: hs.map((h) => hlog(h.id, h.dayKey, h.ts)),
            waterLogs: ws.map((w) => wlog(w.id, w.dayKey, w.ts, w.ml)),
          });
          const r1 = rebuild(b);
          const r2 = rebuild(b);
          expect(r1).toEqual(r2);

          // caps: count grants per day+source
          const counts = new Map<string, number>();
          for (const g of r1.grants) {
            const k = `${g.dayKey}:${g.source}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
            expect(counts.get(k)!).toBeLessThanOrEqual(DAILY_CAP[g.source]);
          }
          // xp is the sum of grants
          expect(r1.state.xp).toBe(r1.grants.reduce((s, g) => s + g.xp, 0));
        },
      ),
      { numRuns: 50 },
    );
  });
});
