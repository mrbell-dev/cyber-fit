import { describe, expect, it } from "vitest";
import { addDays, dayKeyFor, diffDays, weekdayOf, weekKeyOf } from "./time.ts";

// 2026-07-02 12:00:00 UTC
const NOON_UTC = Date.UTC(2026, 6, 2, 12);

describe("dayKeyFor", () => {
  it("plain UTC noon", () => {
    expect(dayKeyFor(NOON_UTC, 0, 0)).toBe("2026-07-02");
  });

  it("1 AM local counts as yesterday with dayStartHour=3", () => {
    // 01:30 local, tz UTC (offset 0)
    const ts = Date.UTC(2026, 6, 2, 1, 30);
    expect(dayKeyFor(ts, 0, 3)).toBe("2026-07-01");
    expect(dayKeyFor(ts, 0, 0)).toBe("2026-07-02");
  });

  it("3:00 AM exactly starts the new day", () => {
    const ts = Date.UTC(2026, 6, 2, 3, 0);
    expect(dayKeyFor(ts, 0, 3)).toBe("2026-07-02");
    expect(dayKeyFor(ts - 1, 0, 3)).toBe("2026-07-01");
  });

  it("timezone offset shifts the day (US Central, UTC-5 → offset +300)", () => {
    // 02:00 UTC = 21:00 previous day local
    const ts = Date.UTC(2026, 6, 2, 2, 0);
    expect(dayKeyFor(ts, 300, 0)).toBe("2026-07-01");
  });

  it("year boundary", () => {
    const ts = Date.UTC(2027, 0, 1, 1, 0);
    expect(dayKeyFor(ts, 0, 3)).toBe("2026-12-31");
  });
});

describe("addDays / diffDays", () => {
  it("round-trips across month ends", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // not a leap year
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("diffDays is signed", () => {
    expect(diffDays("2026-07-01", "2026-07-02")).toBe(1);
    expect(diffDays("2026-07-02", "2026-07-01")).toBe(-1);
    expect(diffDays("2026-01-01", "2027-01-01")).toBe(365);
  });
});

describe("weekday / week keys", () => {
  it("knows 2026-07-02 is a Thursday", () => {
    expect(weekdayOf("2026-07-02")).toBe(4);
  });

  it("weekKeyOf anchors to Monday", () => {
    expect(weekKeyOf("2026-07-02")).toBe("2026-06-29"); // Monday of that week
    expect(weekKeyOf("2026-06-29")).toBe("2026-06-29");
    expect(weekKeyOf("2026-07-05")).toBe("2026-06-29"); // Sunday belongs to same week
    expect(weekKeyOf("2026-07-06")).toBe("2026-07-06"); // next Monday
  });
});
