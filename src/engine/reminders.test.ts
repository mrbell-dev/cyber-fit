import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDERS, duePingsToday, localPings, slotBundleFor, slotsFor } from "./reminders.ts";

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
