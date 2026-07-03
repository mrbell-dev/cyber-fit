import { describe, expect, it } from "vitest";
import { filterByTags, parseTags, stripTags, tagCounts, type TaggedEntry } from "./tags.ts";

describe("parseTags", () => {
  it("extracts, lowercases, dedupes", () => {
    expect(parseTags("Deadlifts #Lift #workout #lift")).toEqual(["lift", "workout"]);
    expect(parseTags("no tags here")).toEqual([]);
    expect(parseTags("#5x5 #push-day #leg_day")).toEqual(["5x5", "push-day", "leg_day"]);
  });
});

describe("stripTags", () => {
  it("cleans display text", () => {
    expect(stripTags("Deadlifts #lift #workout")).toBe("Deadlifts");
    expect(stripTags("#morning run by the pier")).toBe("run by the pier");
  });
});

describe("filterByTags — intersection", () => {
  const e = (kind: TaggedEntry["kind"], text: string, ts: number): TaggedEntry => ({
    kind, ts, dayKey: "2026-07-03", text, tags: parseTags(text),
  });
  const entries = [
    e("workout", "Deadlifts #lift #workout", 3),
    e("workout", "5k #run #workout", 2),
    e("highlight", "PR on squat #lift", 1),
    e("reading", "untagged note", 0),
  ];

  it("#lift #workout intersects to just the deadlifts", () => {
    const hits = filterByTags(entries, ["lift", "workout"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain("Deadlifts");
  });

  it("#lift alone matches two, newest first; untagged never appears", () => {
    const hits = filterByTags(entries, ["lift"]);
    expect(hits.map((h) => h.text)).toEqual(["Deadlifts #lift #workout", "PR on squat #lift"]);
    expect(filterByTags(entries, []).some((h) => h.text === "untagged note")).toBe(false);
  });

  it("tagCounts ranks by frequency", () => {
    expect(tagCounts(entries)[0]).toEqual({ tag: "lift", count: 2 });
  });
});
