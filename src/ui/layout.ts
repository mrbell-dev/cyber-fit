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
