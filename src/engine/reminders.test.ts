import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDERS,
  duePingsToday,
  epochSlot,
  expandOneShots,
  inQuiet,
  localPings,
  MAX_ONE_SHOTS,
  slotBundleFor,
  slotsFor,
} from "./reminders.ts";
import type { OneShotSpec } from "./reminders.ts";
import type { Goal, Habit } from "./types.ts";

describe("localPings", () => {
  it("water spreads count evenly across the window", () => {
    const pings = localPings({
      ...DEFAULT_REMINDERS,
      morning: { on: false, time: "08:00" },
      workout: { on: false, days: [], time: "17:30" },
      catchup: { on: false, time: "21:30" },
      water: { on: true, count: 5, start: "09:00", end: "21:00" },
    });
    expect(pings.map((p) => p.minutes)).toEqual([540, 720, 900, 1080, 1260]); // 9,12,15,18,21
  });

  it("workout only on chosen days", () => {
    const pings = localPings(DEFAULT_REMINDERS).filter((p) => p.kind === "workout");
    expect(pings).toHaveLength(1);
    expect(pings[0].days).toEqual([2, 3, 4]);
  });
});

describe("slotsFor", () => {
  it("UTC zone maps directly onto the grid", () => {
    const slots = slotsFor(DEFAULT_REMINDERS, 0);
    // morning 08:00 daily → slot 480 on all 7 days
    for (let d = 0; d < 7; d++) expect(slots).toContain(d * 1440 + 480);
    // workout 17:30 only Tue(2)/Wed(3)/Thu(4)
    expect(slots).toContain(2 * 1440 + 1050);
    expect(slots).not.toContain(1 * 1440 + 1050);
  });

  it("timezone shift can wrap across the week boundary", () => {
    // 23:30 local Saturday, UTC-(-60) i.e. offset -60 → 22:30 UTC? No:
    // offset +300 (UTC-5): Sat 23:30 local = Sun 04:30 UTC → wraps to day 0.
    const r = {
      ...DEFAULT_REMINDERS,
      morning: { on: false, time: "08:00" },
      water: { on: false, count: 0, start: "09:00", end: "21:00" },
      workout: { on: true, days: [6], time: "23:30" },
      catchup: { on: false, time: "21:30" },
    };
    const slots = slotsFor(r, 300);
    expect(slots).toEqual([270]); // Sunday 04:30 UTC
  });

  it("slots are on-grid, in-range, deduped", () => {
    const slots = slotsFor(DEFAULT_REMINDERS, -330); // UTC+5:30 (off-grid tz)
    expect(new Set(slots).size).toBe(slots.length);
    for (const s of slots) {
      expect(s % 15).toBe(0);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(10080);
    }
  });
});

describe("per-habit reminders", () => {
  const habit = (over: object) => ({
    id: "h1", name: "Stretch", icon: "🦾", schedule: { kind: "daily" as const },
    domain: "general" as const, target: 1, createdAt: 0, order: 0, ...over,
  });

  it("habit with reminderTime pings on its scheduled days only", () => {
    const h = habit({ schedule: { kind: "weekdays", days: [1, 3] }, reminderTime: "07:15" });
    const pings = localPings(DEFAULT_REMINDERS, [h]).filter((p) => p.kind === "habit");
    expect(pings).toHaveLength(1);
    expect(pings[0]).toMatchObject({ minutes: 435, days: [1, 3], label: "Stretch" });
  });

  it("no reminderTime or archived → no ping", () => {
    expect(localPings(DEFAULT_REMINDERS, [habit({})]).filter((p) => p.kind === "habit")).toHaveLength(0);
    expect(
      localPings(DEFAULT_REMINDERS, [habit({ reminderTime: "07:00", archivedAt: 1 })])
        .filter((p) => p.kind === "habit"),
    ).toHaveLength(0);
  });

  const goal = (over: Partial<Goal>): Goal => ({
    id: "g1", name: "Cold plunges", horizon: "lifelong", source: { kind: "manual" },
    createdAt: 0, order: 0, ...over,
  });

  it("goals never ping unless a reminderTime is set (opt-in, off by default)", () => {
    expect(localPings(DEFAULT_REMINDERS, [], [], [goal({})]).filter((p) => p.kind === "goal")).toHaveLength(0);
  });

  it("goal with reminderTime pings daily; archived goals don't", () => {
    const pings = localPings(DEFAULT_REMINDERS, [], [], [goal({ reminderTime: "18:30" })])
      .filter((p) => p.kind === "goal");
    expect(pings).toHaveLength(1);
    expect(pings[0]).toMatchObject({ minutes: 1110, days: [0, 1, 2, 3, 4, 5, 6], label: "Cold plunges" });
    expect(
      localPings(DEFAULT_REMINDERS, [], [], [goal({ reminderTime: "18:30", archivedAt: 1 })])
        .filter((p) => p.kind === "goal"),
    ).toHaveLength(0);
  });

  it("master switch off silences goal pings too", () => {
    expect(
      localPings({ ...DEFAULT_REMINDERS, enabled: false }, [], [], [goal({ reminderTime: "18:30" })]),
    ).toHaveLength(0);
  });

  it("habit slots land in slotsFor", () => {
    const h = habit({ reminderTime: "07:15" });
    const slots = slotsFor(DEFAULT_REMINDERS, 0, [h]);
    for (let d = 0; d < 7; d++) expect(slots).toContain(d * 1440 + 435);
  });
});

describe("highlight reminder", () => {
  it("off by default; on adds a daily ping", () => {
    expect(localPings(DEFAULT_REMINDERS).some((p) => p.kind === "highlight")).toBe(false);
    const on = { ...DEFAULT_REMINDERS, highlight: { on: true, time: "19:00" } };
    const pings = localPings(on).filter((p) => p.kind === "highlight");
    expect(pings).toHaveLength(1);
    expect(pings[0].minutes).toBe(1140);
  });
});

describe("multi-ping habits + motivation slots", () => {
  const habit = (over: object) => ({
    id: "h1", name: "Hydra", icon: "💧", schedule: { kind: "daily" as const },
    domain: "general" as const, target: 1, createdAt: 0, order: 0, ...over,
  });

  it("habit.pings spreads N pings across its window", () => {
    const h = habit({ pings: { times: 3, start: "09:00", end: "21:00", untilDone: true } });
    const pings = localPings(DEFAULT_REMINDERS, [h]).filter((p) => p.kind === "habit");
    expect(pings.map((p) => p.minutes)).toEqual([540, 900, 1260]);
    expect(pings.every((p) => p.untilDone && p.habitId === "h1")).toBe(true);
  });

  it("motivation slots are separated from reminder slots", () => {
    const r = { ...DEFAULT_REMINDERS, motivation: { on: true, count: 2, start: "10:00", end: "18:00" } };
    const bundle = slotBundleFor(r, 0);
    expect(bundle.motivationSlots.length).toBeGreaterThan(0);
    // 10:00 and 18:00 daily → slots at day*1440+600 and day*1440+1080
    expect(bundle.motivationSlots).toContain(600);
    expect(bundle.slots).not.toContain(600);
    // motivation off by default → empty
    expect(slotBundleFor(DEFAULT_REMINDERS, 0).motivationSlots).toEqual([]);
  });
});

describe("med habits", () => {
  it("med habits: escalation pings are in-app only; push gets one dueTime slot", () => {
    const med: Habit = {
      id: "m",
      name: "Allergy pill",
      icon: "💊",
      schedule: { kind: "daily" },
      domain: "general",
      target: 1,
      createdAt: 0,
      order: 1,
      area: "meds",
      med: { dueTime: "09:00", remindEveryMin: 60, windowMin: 240 },
    };
    const pings = localPings(DEFAULT_REMINDERS, [med]);
    const mine = pings.filter((p) => p.habitId === "m");
    // 09:00,10:00,11:00,12:00 — every remindEveryMin across the window
    expect(mine.map((p) => p.minutes)).toEqual([540, 600, 660, 720]);
    expect(mine.every((p) => p.untilDone)).toBe(true);
    expect(mine.filter((p) => !p.inAppOnly).map((p) => p.minutes)).toEqual([540]); // push: dueTime only
    const { slots } = slotBundleFor(DEFAULT_REMINDERS, 0, [med]);
    const medSlots = slots.filter((s) => s % 1440 === 540); // 09:00 UTC each day
    expect(medSlots.length).toBe(7); // one per day, not four
  });

  it("med window crossing midnight puts overflow pings on the next weekday", () => {
    const shot: Habit = {
      id: "s",
      name: "Weekly booster",
      icon: "💉",
      schedule: { kind: "weekdays", days: [5] },
      domain: "general",
      target: 1,
      createdAt: 0,
      order: 1,
      area: "meds",
      med: { dueTime: "18:00", remindEveryMin: 720, windowMin: 1440 },
    };
    const mine = localPings(DEFAULT_REMINDERS, [shot]).filter((p) => p.habitId === "s");
    // 18:00 Fri, 06:00 Sat (1080+720=1800 → 360 on day+1), 18:00 Sat would equal close → excluded
    expect(mine.map((p) => [p.days[0], p.minutes])).toEqual([[5, 1080], [6, 360]]);
  });
});

describe("duePingsToday", () => {
  it("returns only pings already past on a matching weekday", () => {
    // Thursday (4), 12:00 local.
    const due = duePingsToday(DEFAULT_REMINDERS, 4, 720);
    const kinds = due.map((d) => d.kind);
    expect(kinds).toContain("morning"); // 08:00 passed
    expect(kinds).not.toContain("catchup"); // 21:30 not yet
    expect(kinds).not.toContain("workout"); // 17:30 not yet
    expect(due.filter((d) => d.kind === "water")).toHaveLength(2); // 09:00 + 12:00
  });

  it("weekday mismatch excludes workout", () => {
    const due = duePingsToday(DEFAULT_REMINDERS, 5, 1200); // Friday 20:00
    expect(due.map((d) => d.kind)).not.toContain("workout");
  });
});

describe("master switch + quiet hours", () => {
  it("enabled:false produces no pings", () => {
    expect(localPings({ ...DEFAULT_REMINDERS, enabled: false })).toHaveLength(0);
    expect(slotsFor({ ...DEFAULT_REMINDERS, enabled: false }, 0)).toHaveLength(0);
  });

  it("quiet hours defer an in-window ping to when quiet lifts", () => {
    // catchup 21:30 (1290) inside 22:00? no. Use a late catchup at 23:00.
    const r = {
      ...DEFAULT_REMINDERS,
      morning: { on: false, time: "08:00" },
      water: { on: false, count: 0, start: "09:00", end: "21:00" },
      workout: { on: false, days: [], time: "17:30" },
      highlight: { on: false, time: "19:00" },
      catchup: { on: true, time: "23:00" }, // inside quiet 22:00–07:00
      quiet: { on: true, start: "22:00", end: "07:00" },
    };
    const catchup = localPings(r).filter((p) => p.kind === "catchup");
    expect(catchup).toHaveLength(1);
    expect(catchup[0].minutes).toBe(7 * 60); // deferred to 07:00
  });

  it("quiet hours leave out-of-window pings untouched", () => {
    const r = {
      ...DEFAULT_REMINDERS,
      morning: { on: true, time: "08:00" }, // outside 22:00–07:00
      water: { on: false, count: 0, start: "09:00", end: "21:00" },
      workout: { on: false, days: [], time: "17:30" },
      catchup: { on: false, time: "21:30" },
      quiet: { on: true, start: "22:00", end: "07:00" },
    };
    const morning = localPings(r).filter((p) => p.kind === "morning");
    expect(morning[0].minutes).toBe(8 * 60);
  });

  it("inQuiet handles overnight wrap and same-day windows", () => {
    expect(inQuiet(23 * 60, 22 * 60, 7 * 60)).toBe(true); // 23:00 in 22–07
    expect(inQuiet(6 * 60, 22 * 60, 7 * 60)).toBe(true); // 06:00 in 22–07
    expect(inQuiet(12 * 60, 22 * 60, 7 * 60)).toBe(false); // noon not quiet
    expect(inQuiet(13 * 60, 13 * 60, 14 * 60)).toBe(true); // same-day nap window
    expect(inQuiet(14 * 60, 13 * 60, 14 * 60)).toBe(false); // end is exclusive
  });
});

describe("expandOneShots", () => {
  // local midnight anchors — expansion runs in local time, same as the UI
  const jan5 = new Date(2026, 0, 5).getTime(); // Mon Jan 5 2026, 00:00 local
  const spec = (over: Partial<OneShotSpec> = {}): OneShotSpec => ({
    kind: "gig",
    anchorDayMs: jan5,
    periodDays: 7,
    time: "09:00",
    ...over,
  });

  it("steps anchor + n·period at the local fire time, epoch-slotted", () => {
    const now = jan5 + 60 * 60_000; // Jan 5, 01:00 — anchor day itself never fires
    const out = expandOneShots([spec()], now, undefined, 15);
    expect(out).toHaveLength(2); // Jan 12 + Jan 19 inside 15-day horizon
    expect(out[0].at).toBe(epochSlot(new Date(2026, 0, 12, 9, 0).getTime()));
    expect(out[1].at).toBe(epochSlot(new Date(2026, 0, 19, 9, 0).getTime()));
    expect(out.every((o) => o.kind === "gig")).toBe(true);
  });

  it("skips past occurrences — overdue is the banner's job, not a stale push", () => {
    const now = new Date(2026, 0, 12, 12, 0).getTime(); // noon, after the 09:00 firing
    const out = expandOneShots([spec()], now, undefined, 8);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(epochSlot(new Date(2026, 0, 19, 9, 0).getTime()));
  });

  it("dayOfMonth anchors to the calendar, no drift", () => {
    const now = new Date(2026, 0, 10).getTime();
    const out = expandOneShots([spec({ dayOfMonth: 15, periodDays: 0 })], now, undefined, 42);
    expect(out.map((o) => o.at)).toEqual([
      epochSlot(new Date(2026, 0, 15, 9, 0).getTime()),
      epochSlot(new Date(2026, 1, 15, 9, 0).getTime()),
    ]);
  });

  it("dayOfMonth 31 clamps to the month's last day (Feb 28)", () => {
    const now = new Date(2026, 0, 20).getTime();
    const out = expandOneShots([spec({ dayOfMonth: 31, periodDays: 0 })], now, undefined, 42);
    expect(out.map((o) => o.at)).toEqual([
      epochSlot(new Date(2026, 0, 31, 9, 0).getTime()),
      epochSlot(new Date(2026, 1, 28, 9, 0).getTime()), // 2026 is not a leap year
    ]);
  });

  it("quiet hours defer the fire time like any other ping", () => {
    const now = jan5 + 60 * 60_000;
    const quiet = { on: true, start: "22:00", end: "10:30" };
    const out = expandOneShots([spec()], now, quiet, 8); // 09:00 is inside quiet
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(epochSlot(new Date(2026, 0, 12, 10, 30).getTime()));
  });

  it("ignores invalid specs: period < 1 without dayOfMonth, dom out of range", () => {
    const now = jan5 + 60 * 60_000;
    expect(expandOneShots([spec({ periodDays: 0 })], now)).toHaveLength(0);
    expect(expandOneShots([spec({ dayOfMonth: 0 })], now)).toHaveLength(0);
    expect(expandOneShots([spec({ dayOfMonth: 32 })], now)).toHaveLength(0);
  });

  it("merges specs sorted by time and caps at MAX_ONE_SHOTS", () => {
    const now = jan5 + 60 * 60_000;
    const daily = spec({ periodDays: 1, time: "08:00" });
    const weekly = spec({ time: "09:00", kind: "habit" });
    const out = expandOneShots([weekly, daily], now, undefined, 365);
    expect(out).toHaveLength(MAX_ONE_SHOTS);
    for (let i = 1; i < out.length; i++) expect(out[i].at).toBeGreaterThanOrEqual(out[i - 1].at);
    // earliest firings win the cap — daily 08:00 lands before weekly 09:00
    expect(out[0].at).toBe(epochSlot(new Date(2026, 0, 6, 8, 0).getTime()));
  });

  it("returns nothing when the anchor's next firing is beyond the horizon", () => {
    const now = jan5 + 60 * 60_000;
    expect(expandOneShots([spec({ periodDays: 30 })], now, undefined, 20)).toHaveLength(0);
  });
});
