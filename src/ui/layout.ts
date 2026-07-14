export type BlockId =
  | "directives" | "water" | "gigs" | "mood" | "highlight"
  | "goalsPanel" | "weight" | "volume" | "breathing";

export interface LayoutPage { id: string; blocks: BlockId[] }

export interface NavEntry {
  id: string;
  kind: "page" | "screen";
  label?: string;
  glyph?: string;
  group?: string;
  hidden?: boolean;
}

export interface LayoutConfig { pages: LayoutPage[]; nav: NavEntry[] }

export function defaultLayout(): LayoutConfig {
  return {
    pages: [
      { id: "home", blocks: ["directives", "water", "gigs", "mood", "highlight", "goalsPanel"] },
    ],
    nav: [
      { id: "home", kind: "page" },
      { id: "training", kind: "screen", group: "Grind" },
      { id: "bio", kind: "screen", group: "Grind" },
      { id: "feed", kind: "screen", group: "Grind" },
      { id: "goals", kind: "screen", group: "Grind" },
      { id: "telemetry", kind: "screen" },
    ],
  };
}

function mapPage(
  cfg: LayoutConfig, pageId: string, fn: (blocks: BlockId[]) => BlockId[],
): LayoutConfig {
  return {
    ...cfg,
    pages: cfg.pages.map((p) => (p.id === pageId ? { ...p, blocks: fn(p.blocks) } : p)),
  };
}

export function addBlock(cfg: LayoutConfig, pageId: string, block: BlockId): LayoutConfig {
  return mapPage(cfg, pageId, (blocks) =>
    blocks.includes(block) ? blocks : [...blocks, block]);
}

export function removeBlock(cfg: LayoutConfig, pageId: string, block: BlockId): LayoutConfig {
  return mapPage(cfg, pageId, (blocks) => blocks.filter((b) => b !== block));
}

export function moveBlock(
  cfg: LayoutConfig, pageId: string, block: BlockId, dir: -1 | 1,
): LayoutConfig {
  return mapPage(cfg, pageId, (blocks) => {
    const i = blocks.indexOf(block);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

// ---------- nav defaults ----------

export const NAV_DEFAULTS: Record<string, { label: string; glyph: string }> = {
  home: { label: "Directives", glyph: "◉" },
  training: { label: "Training", glyph: "⚔" },
  bio: { label: "Bio", glyph: "⌬" },
  feed: { label: "Feed", glyph: "▤" },
  goals: { label: "Goals", glyph: "◎" },
  telemetry: { label: "Telemetry", glyph: "∿" },
};

export function navLabel(e: NavEntry): string {
  return e.label ?? NAV_DEFAULTS[e.id]?.label ?? "Page";
}
export function navGlyph(e: NavEntry): string {
  return e.glyph ?? NAV_DEFAULTS[e.id]?.glyph ?? "▪";
}

// ---------- nav operations ----------

function mapNav(cfg: LayoutConfig, id: string, fn: (e: NavEntry) => NavEntry): LayoutConfig {
  return { ...cfg, nav: cfg.nav.map((e) => (e.id === id ? fn(e) : e)) };
}

export function renameNavEntry(cfg: LayoutConfig, id: string, label: string): LayoutConfig {
  const trimmed = label.trim();
  return mapNav(cfg, id, (e) => {
    const { label: _drop, ...rest } = e;
    return trimmed ? { ...rest, label: trimmed } : rest;
  });
}

export function setNavHidden(cfg: LayoutConfig, id: string, hidden: boolean): LayoutConfig {
  return mapNav(cfg, id, (e) => {
    const { hidden: _drop, ...rest } = e;
    return hidden ? { ...rest, hidden: true } : rest;
  });
}

export function setNavGroup(cfg: LayoutConfig, id: string, group: string | undefined): LayoutConfig {
  const trimmed = group?.trim();
  return mapNav(cfg, id, (e) => {
    const { group: _drop, ...rest } = e;
    return trimmed ? { ...rest, group: trimmed } : rest;
  });
}

export function visibleNav(cfg: LayoutConfig): NavEntry[] {
  return cfg.nav.filter((e) => !e.hidden);
}
export function hiddenNav(cfg: LayoutConfig): NavEntry[] {
  return cfg.nav.filter((e) => e.hidden);
}

/** Reorder within siblings: entries sharing the same group (or both ungrouped)
 *  and the same hidden state. Swaps flat-array positions so drawers keep
 *  their anchor position. */
export function moveNavEntry(cfg: LayoutConfig, id: string, dir: -1 | 1): LayoutConfig {
  const nav = cfg.nav;
  const i = nav.findIndex((n) => n.id === id);
  if (i < 0) return cfg;
  const me = nav[i];
  const sibIdx = nav
    .map((_n, idx) => idx)
    .filter((idx) => (nav[idx].group ?? "") === (me.group ?? "") && !!nav[idx].hidden === !!me.hidden);
  const pos = sibIdx.indexOf(i);
  const j = pos + dir;
  if (j < 0 || j >= sibIdx.length) return cfg;
  const next = [...nav];
  [next[i], next[sibIdx[j]]] = [next[sibIdx[j]], next[i]];
  return { ...cfg, nav: next };
}

// ---------- page operations ----------

export function addPage(
  cfg: LayoutConfig, name: string, glyph: string,
): { cfg: LayoutConfig; id: string } {
  const id = crypto.randomUUID();
  const label = name.trim() || "New page";
  return {
    id,
    cfg: {
      pages: [...cfg.pages, { id, blocks: [] }],
      nav: [...cfg.nav, { id, kind: "page", label, glyph }],
    },
  };
}

/** Custom pages only. "home" and built-in screens are structural. */
export function deletePage(cfg: LayoutConfig, id: string): LayoutConfig {
  const entry = cfg.nav.find((n) => n.id === id);
  if (id === "home" || !entry || entry.kind !== "page") return cfg;
  return {
    pages: cfg.pages.filter((p) => p.id !== id),
    nav: cfg.nav.filter((n) => n.id !== id),
  };
}
