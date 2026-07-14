import { describe, it, expect } from "vitest";
import {
  defaultLayout, addBlock, removeBlock, moveBlock,
  NAV_DEFAULTS, navLabel, navGlyph, renameNavEntry, setNavHidden,
  setNavGroup, moveNavEntry, visibleNav, hiddenNav, addPage, deletePage,
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

describe("nav defaults", () => {
  it("labels/glyphs for every default entry", () => {
    for (const e of defaultLayout().nav) {
      expect(NAV_DEFAULTS[e.id]).toBeDefined();
      expect(navLabel(e)).toBe(NAV_DEFAULTS[e.id].label);
      expect(navGlyph(e)).toBe(NAV_DEFAULTS[e.id].glyph);
    }
  });
  it("label override wins; unknown id falls back", () => {
    expect(navLabel({ id: "training", kind: "screen", label: "Ops" })).toBe("Ops");
    expect(navLabel({ id: "xyz", kind: "page" })).toBe("Page");
    expect(navGlyph({ id: "xyz", kind: "page" })).toBe("▪");
  });
});

describe("renameNavEntry", () => {
  it("sets a trimmed label override", () => {
    const cfg = renameNavEntry(defaultLayout(), "training", "  Ops  ");
    expect(cfg.nav.find((n) => n.id === "training")?.label).toBe("Ops");
  });
  it("blank reverts to default (label dropped)", () => {
    let cfg = renameNavEntry(defaultLayout(), "training", "Ops");
    cfg = renameNavEntry(cfg, "training", "   ");
    expect(cfg.nav.find((n) => n.id === "training")?.label).toBeUndefined();
  });
  it("does not mutate input", () => {
    const before = defaultLayout();
    const snap = JSON.stringify(before);
    renameNavEntry(before, "training", "Ops");
    expect(JSON.stringify(before)).toBe(snap);
  });
});

describe("setNavHidden / visibleNav / hiddenNav", () => {
  it("hide moves entry to hiddenNav, unhide restores", () => {
    let cfg = setNavHidden(defaultLayout(), "feed", true);
    expect(hiddenNav(cfg).map((n) => n.id)).toEqual(["feed"]);
    expect(visibleNav(cfg).some((n) => n.id === "feed")).toBe(false);
    cfg = setNavHidden(cfg, "feed", false);
    expect(hiddenNav(cfg)).toEqual([]);
  });
});

describe("setNavGroup", () => {
  it("moves entry into a named drawer; blank/undefined ungroups", () => {
    let cfg = setNavGroup(defaultLayout(), "telemetry", "Grind");
    expect(cfg.nav.find((n) => n.id === "telemetry")?.group).toBe("Grind");
    cfg = setNavGroup(cfg, "telemetry", "  ");
    expect(cfg.nav.find((n) => n.id === "telemetry")?.group).toBeUndefined();
  });
});

describe("moveNavEntry", () => {
  it("swaps with the neighbor in the same group only", () => {
    const cfg = moveNavEntry(defaultLayout(), "bio", -1);
    const ids = cfg.nav.map((n) => n.id);
    expect(ids).toEqual(["home", "bio", "training", "feed", "goals", "telemetry"]);
  });
  it("no-op at the edge of its group", () => {
    const cfg = moveNavEntry(defaultLayout(), "training", -1);
    expect(cfg.nav.map((n) => n.id)).toEqual(defaultLayout().nav.map((n) => n.id));
  });
  it("ungrouped entries skip over grouped ones", () => {
    // "home" (no group) moving down should swap with "telemetry" (no group),
    // jumping the whole Grind drawer.
    const cfg = moveNavEntry(defaultLayout(), "home", 1);
    const ids = cfg.nav.map((n) => n.id);
    expect(ids).toEqual(["telemetry", "training", "bio", "feed", "goals", "home"]);
  });
});

describe("addPage", () => {
  it("creates an empty uuid page plus a nav entry with label/glyph", () => {
    const { cfg, id } = addPage(defaultLayout(), "Recovery", "🌙");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(cfg.pages.find((p) => p.id === id)?.blocks).toEqual([]);
    const e = cfg.nav.at(-1)!;
    expect(e).toEqual({ id, kind: "page", label: "Recovery", glyph: "🌙" });
  });
  it("blank name gets a fallback label", () => {
    const { cfg, id } = addPage(defaultLayout(), "   ", "⚡");
    expect(cfg.nav.find((n) => n.id === id)?.label).toBe("New page");
  });
});

describe("deletePage", () => {
  it("drops the page and its nav entry", () => {
    const { cfg, id } = addPage(defaultLayout(), "Recovery", "🌙");
    const next = deletePage(cfg, id);
    expect(next.pages.some((p) => p.id === id)).toBe(false);
    expect(next.nav.some((n) => n.id === id)).toBe(false);
  });
  it("refuses to delete home or screens", () => {
    const cfg = defaultLayout();
    expect(deletePage(cfg, "home")).toEqual(cfg);
    expect(deletePage(cfg, "training")).toEqual(cfg);
  });
});
