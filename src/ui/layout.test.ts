import { describe, it, expect } from "vitest";
import {
  defaultLayout, addBlock, removeBlock, moveBlock,
} from "./layout";

describe("defaultLayout", () => {
  it("home page matches today's block order exactly", () => {
    expect(defaultLayout().pages).toEqual([
      { id: "home", blocks: ["directives", "water", "gigs", "mood", "highlight", "goalsPanel"] },
    ]);
  });
  it("nav mirrors current drawer incl. Grind group, excl. System", () => {
    const nav = defaultLayout().nav;
    expect(nav.map((n) => n.id)).toEqual(["home", "training", "bio", "feed", "goals", "telemetry"]);
    expect(nav.find((n) => n.id === "training")?.group).toBe("Grind");
    expect(nav.some((n) => n.id === "system")).toBe(false);
  });
});

describe("addBlock", () => {
  it("appends to the page", () => {
    const cfg = addBlock(defaultLayout(), "home", "weight");
    expect(cfg.pages[0].blocks.at(-1)).toBe("weight");
  });
  it("is a no-op when block already on page (once per page)", () => {
    const cfg = addBlock(defaultLayout(), "home", "water");
    expect(cfg.pages[0].blocks.filter((b) => b === "water")).toHaveLength(1);
  });
  it("does not mutate its input", () => {
    const before = defaultLayout();
    const snapshot = JSON.stringify(before);
    addBlock(before, "home", "weight");
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("removeBlock", () => {
  it("removes the block, leaves others in order", () => {
    const cfg = removeBlock(defaultLayout(), "home", "water");
    expect(cfg.pages[0].blocks).toEqual(["directives", "gigs", "mood", "highlight", "goalsPanel"]);
  });
  it("no-op for a block not on the page", () => {
    const cfg = removeBlock(defaultLayout(), "home", "weight");
    expect(cfg).toEqual(defaultLayout());
  });
});

describe("moveBlock", () => {
  it("moves a block up", () => {
    const cfg = moveBlock(defaultLayout(), "home", "gigs", -1);
    expect(cfg.pages[0].blocks.slice(0, 3)).toEqual(["directives", "gigs", "water"]);
  });
  it("clamps at the edges", () => {
    const top = moveBlock(defaultLayout(), "home", "directives", -1);
    expect(top).toEqual(defaultLayout());
    const bottom = moveBlock(defaultLayout(), "home", "goalsPanel", 1);
    expect(bottom).toEqual(defaultLayout());
  });
  it("unknown pageId is a no-op, never throws", () => {
    expect(() => moveBlock(defaultLayout(), "nope", "water", 1)).not.toThrow();
  });
});
