import { describe, expect, it } from "vitest";
import type { DayKey } from "./time.ts";
import type { Gig, GigTemplate } from "./types.ts";
import { cadenceLabel, templatesDue } from "./gigs.ts";

const WED = "2026-07-15" as DayKey;
const THU = "2026-07-16" as DayKey; // weekday 4

const tpl = (over: Partial<GigTemplate> = {}): GigTemplate => ({
  id: "t1",
  text: "stretch",
  days: [0, 1, 2, 3, 4, 5, 6],
  ts: 1,
  ...over,
});

const gig = (over: Partial<Gig> = {}): Gig => ({
  id: "g1",
  text: "stretch",
  createdDay: THU,
  ts: 1,
  ...over,
});

describe("cadenceLabel", () => {
  it("labels a full week as daily, otherwise sorted day names", () => {
    expect(cadenceLabel([0, 1, 2, 3, 4, 5, 6])).toBe("daily");
    expect(cadenceLabel([1, 3, 5])).toBe("Mo We Fr");
    expect(cadenceLabel([5, 1])).toBe("Mo Fr");
  });
});

describe("templatesDue", () => {
  it("spawns on a scheduled weekday", () => {
    expect(templatesDue([tpl()], [], THU)).toHaveLength(1);
    expect(templatesDue([tpl({ days: [4] })], [], THU)).toHaveLength(1);
  });

  it("skips unscheduled weekdays and retired templates", () => {
    expect(templatesDue([tpl({ days: [5] })], [], THU)).toHaveLength(0);
    expect(templatesDue([tpl({ retiredTs: 5 })], [], THU)).toHaveLength(0);
  });

  it("won't double-spawn: today's copy blocks regardless of state", () => {
    const spawned = gig({ templateId: "t1" });
    expect(templatesDue([tpl()], [spawned], THU)).toHaveLength(0);
    const doneToday = gig({ templateId: "t1", doneTs: 5, doneDay: THU });
    expect(templatesDue([tpl()], [doneToday], THU)).toHaveLength(0);
  });

  it("an open rollover from a prior day is today's job — no twin", () => {
    const rollover = gig({ templateId: "t1", createdDay: WED });
    expect(templatesDue([tpl()], [rollover], THU)).toHaveLength(0);
  });

  it("respawns after a prior day's copy was completed", () => {
    const doneYesterday = gig({ templateId: "t1", createdDay: WED, doneTs: 5, doneDay: WED });
    expect(templatesDue([tpl()], [doneYesterday], THU)).toHaveLength(1);
  });

  it("ignores manual gigs with the same text", () => {
    const manual = gig(); // no templateId
    expect(templatesDue([tpl()], [manual], THU)).toHaveLength(1);
  });
});
