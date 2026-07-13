# Custom Dashboards — Slice 1 (Dashboard Blocks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home page becomes an editable dashboard of pinnable blocks (add/remove/reorder), stored in one `kv` row, defaulting to exactly today's layout.

**Architecture:** Pure layout logic in `src/ui/layout.ts` (tested with vitest); single write path `setLayout()` in `src/db/repo.ts`; block registry in `src/ui/blocks.ts` whose entries are prop-less components; `Dashboard` component renders a page's block list and hosts edit mode. `Today.tsx` shrinks to banners + `<Dashboard pageId="home" />`.

**Tech Stack:** React + TypeScript, Dexie (`useLiveQuery`), vitest, existing `kv` table (no schema bump).

## Global Constraints

- Default layout is **exactly today's layout**; no DB write until first edit.
- No Dexie schema bump — one new `kv` row, key `"layout"`.
- Blocks are views over existing tables; remove never deletes data. Remove copy: "Unplugged, not wiped — your logs are untouched."
- Accessibility: 48px touch targets, `aria-label` on every icon button, arrow-button reorder (no drag-and-drop).
- App chrome (`Onboarding`, `DailyBoot`, `GigMigration`, `MissedPing`, `GoalBanner`, `XpBar`) is NOT a block — stays pinned above the dashboard.
- `FocusTimer` is excluded from v1 blocks.
- Copy: kind at 11pm, mechanic named positively, at most one StreetSlang term per string.
- Layout KV row written **only** via `setLayout()` in `src/db/repo.ts`.

---

### Task 1: Pure layout logic (`layout.ts`)

**Files:**
- Create: `src/ui/layout.ts`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Produces: `BlockId`, `LayoutPage`, `NavEntry`, `LayoutConfig` types; `defaultLayout(): LayoutConfig`; `addBlock(cfg, pageId, block): LayoutConfig`; `removeBlock(cfg, pageId, block): LayoutConfig`; `moveBlock(cfg, pageId, block, dir: -1 | 1): LayoutConfig`. All functions are pure (return new objects, never mutate).

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/layout.test.ts
import { describe, it, expect } from "vitest";
import {
  defaultLayout, addBlock, removeBlock, moveBlock, type LayoutConfig,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'` (or all suites failing).

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/layout.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout.ts src/ui/layout.test.ts
git commit -m "feat: pure layout config logic with default derivation"
```

---

### Task 2: Layout persistence (`repo.ts` + `useLayout` hook)

**Files:**
- Modify: `src/db/repo.ts` (append at end of file)
- Create: `src/ui/useLayout.ts`

**Interfaces:**
- Consumes: `LayoutConfig`, `defaultLayout` from Task 1; existing `db.kv` Dexie table (rows `{ key: string; value: unknown }`) and the existing `kvGet`/`kvSet` helpers in `repo.ts` — reuse them; do not touch `db.kv` directly.
- Produces: `getLayout(): Promise<LayoutConfig>`, `setLayout(cfg: LayoutConfig): Promise<void>` in `repo.ts`; React hook `useLayout(): LayoutConfig` (live, defaults when row absent).

- [ ] **Step 1: Add repo functions**

Append to `src/db/repo.ts`:

```ts
import { defaultLayout, type LayoutConfig } from "../ui/layout";

/** Single write path for the layout row. Nothing else writes kv key "layout". */
export async function setLayout(cfg: LayoutConfig): Promise<void> {
  await kvSet("layout", cfg);
}

export async function getLayout(): Promise<LayoutConfig> {
  return ((await kvGet("layout")) as LayoutConfig | undefined) ?? defaultLayout();
}
```

(If `repo.ts` names its kv helpers differently, use the existing names — the requirement is: reuse the existing kv accessor, add no new table.)

- [ ] **Step 2: Create the hook**

```ts
// src/ui/useLayout.ts
import { useLiveQuery } from "dexie-react-hooks";
import { getLayout } from "../db/repo";
import { defaultLayout, type LayoutConfig } from "./layout";

export function useLayout(): LayoutConfig {
  return useLiveQuery(getLayout, [], defaultLayout());
}
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/repo.ts src/ui/useLayout.ts
git commit -m "feat: layout kv persistence with single write path"
```

---

### Task 3: Extract `DirectivesCard` from `Today.tsx`

**Files:**
- Create: `src/ui/components/DirectivesCard.tsx`
- Modify: `src/ui/screens/Today.tsx` (delete the inline directives card + its local state; render `<DirectivesCard />` in its place)

**Interfaces:**
- Produces: `DirectivesCard: () => JSX.Element` — no props, fully self-contained (own `useLiveQuery` for directives, own editor state, keeps the empty-state copy "Install grounding protocol").

- [ ] **Step 1: Move the code**

Cut the ~55-line directives card JSX from `Today.tsx` — the section starting at the directives card wrapper (search for `Directives` heading / "Install grounding protocol") — **plus** its supporting local state (`useState` for the editor open/draft) and the directives `useLiveQuery`/repo calls, into a new component. Move, don't rewrite — behavior must be byte-identical:

```tsx
// src/ui/components/DirectivesCard.tsx
// Pasted verbatim from Today.tsx: the directives useLiveQuery, editor
// useState hooks, save/delete handlers, and the card JSX (including the
// "Install grounding protocol" empty state). Only changes permitted:
// - wrap in `export function DirectivesCard() { ... }`
// - add the imports the moved code needs (react, dexie-react-hooks,
//   repo functions, any shared UI atoms it referenced).
export function DirectivesCard() {
  /* moved code, unchanged */
}
```

In `Today.tsx`, replace the removed JSX with `<DirectivesCard />` and add the import; delete now-unused imports/state.

- [ ] **Step 2: Verify no behavior change**

Run: `npm test && npx tsc --noEmit && npm run dev` (spot-check: directives card renders, editor opens, empty state shows when no directives).
Expected: identical behavior to before.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/DirectivesCard.tsx src/ui/screens/Today.tsx
git commit -m "refactor: extract DirectivesCard from Today"
```

---

### Task 4: Block registry (`blocks.ts` + wrappers)

**Files:**
- Create: `src/ui/blocks.tsx`
- Consumes: `DirectivesCard` (Task 3); existing components `WaterGauge`, `Gigs`, `Mood`, `Highlight`, `GoalsPanel`, `WeightChart`, `VolumeChart`, `BreathingOverlay`; existing hooks `useDayKey()` (returns today's day key) and the water-fetching `useLiveQuery` currently in `Today.tsx`.

**Interfaces:**
- Produces: `BLOCKS: Record<BlockId, BlockDef>` where `BlockDef = { id: BlockId; name: string; desc: string; Component: () => JSX.Element }`.

- [ ] **Step 1: Write the registry**

```tsx
// src/ui/blocks.tsx
import type { JSX } from "react";
import type { BlockId } from "./layout";
import { DirectivesCard } from "./components/DirectivesCard";
// Import WaterGauge, Gigs, Mood, Highlight, GoalsPanel, WeightChart,
// VolumeChart, BreathingOverlay, useDayKey from their existing paths
// (see current imports at the top of Today.tsx / Bio.tsx / Stats.tsx).

export interface BlockDef {
  id: BlockId;
  name: string;
  desc: string;
  Component: () => JSX.Element;
}

// Wrappers: each does exactly the data fetch its host screen does today,
// moved here so the block is prop-less. Copy the fetch code verbatim from
// the host screen (Today.tsx for water/gigs/mood/highlight/goalsPanel,
// Bio.tsx for weight quick-log, Stats.tsx for volume).
function WaterBlock() { /* Today's water useLiveQuery + <WaterGauge …/> */ }
function GigsBlock() { const today = useDayKey(); return <Gigs today={today} />; }
function MoodBlock() { const today = useDayKey(); return <Mood today={today} />; }
function HighlightBlock() { const today = useDayKey(); return <Highlight today={today} />; }
function GoalsBlock() { const today = useDayKey(); return <GoalsPanel today={today} />; }
function WeightBlock() { /* WeightChart + Bio's quick-log entry row, moved verbatim */ }
function VolumeBlock() { const today = useDayKey(); return <VolumeChart today={today} />; }
function BreathingBlock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button style={{ minHeight: 48 }} onClick={() => setOpen(true)}>
        Breathing — 60 seconds to reset
      </button>
      {open && <BreathingOverlay onClose={() => setOpen(false)} />}
    </div>
  );
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  directives: { id: "directives", name: "Directives",   desc: "Your standing orders for the day",        Component: DirectivesCard },
  water:      { id: "water",      name: "Water",        desc: "Hydration gauge and quick logging",       Component: WaterBlock },
  gigs:       { id: "gigs",       name: "Gigs",         desc: "Today's one-off missions",                Component: GigsBlock },
  mood:       { id: "mood",       name: "Mood",         desc: "One-tap mood check-in",                   Component: MoodBlock },
  highlight:  { id: "highlight",  name: "Highlight",    desc: "The one thing that matters most today",   Component: HighlightBlock },
  goalsPanel: { id: "goalsPanel", name: "Goals",        desc: "Active goals at a glance",                Component: GoalsBlock },
  weight:     { id: "weight",     name: "Weight",       desc: "Trend chart plus quick log",              Component: WeightBlock },
  volume:     { id: "volume",     name: "Training volume", desc: "Lifted volume over time",              Component: VolumeBlock },
  breathing:  { id: "breathing",  name: "Breathing",    desc: "Launch a guided breathing session",       Component: BreathingBlock },
};
```

- [ ] **Step 2: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. (Registry is exercised visually in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/blocks.tsx
git commit -m "feat: block registry with prop-less block wrappers"
```

---

### Task 5: `Dashboard` component with edit mode + add-block sheet

**Files:**
- Create: `src/ui/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useLayout` (Task 2), `setLayout` from `src/db/repo.ts`, `addBlock`/`removeBlock`/`moveBlock` (Task 1), `BLOCKS` (Task 4).
- Produces: `Dashboard({ pageId }: { pageId: string }): JSX.Element`.

- [ ] **Step 1: Write the component**

```tsx
// src/ui/components/Dashboard.tsx
import { useState } from "react";
import { useLayout } from "../useLayout";
import { setLayout } from "../../db/repo";
import { addBlock, removeBlock, moveBlock, type BlockId } from "../layout";
import { BLOCKS } from "../blocks";

export function Dashboard({ pageId }: { pageId: string }) {
  const cfg = useLayout();
  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const page = cfg.pages.find((p) => p.id === pageId);
  if (!page) return <p>Page offline. Head to System to reset your layout.</p>;

  const installed = new Set(page.blocks);

  return (
    <section aria-label="Dashboard">
      <div className="dash-header">
        <button
          aria-label={editing ? "Done reconfiguring" : "Reconfig dashboard"}
          style={{ minHeight: 48, minWidth: 48 }}
          onClick={() => { setEditing(!editing); setSheetOpen(false); }}
        >
          {editing ? "Done" : "⧉ Reconfig"}
        </button>
      </div>

      {page.blocks.map((id, i) => {
        const def = BLOCKS[id];
        if (!def) return null; // unknown id (future version) — skip, never crash
        return (
          <div key={id} className="dash-block">
            {editing && (
              <div className="block-toolbar" role="group" aria-label={`${def.name} controls`}>
                <button aria-label={`Move ${def.name} up`} disabled={i === 0}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(moveBlock(cfg, pageId, id, -1))}>▲</button>
                <button aria-label={`Move ${def.name} down`} disabled={i === page.blocks.length - 1}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(moveBlock(cfg, pageId, id, 1))}>▼</button>
                <button aria-label={`Remove ${def.name}`}
                  style={{ minHeight: 48, minWidth: 48 }}
                  onClick={() => setLayout(removeBlock(cfg, pageId, id))}>✕</button>
              </div>
            )}
            <div style={editing ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
              <def.Component />
            </div>
          </div>
        );
      })}

      {editing && (
        <>
          <button style={{ minHeight: 48, width: "100%" }} onClick={() => setSheetOpen(true)}>
            + Add block
          </button>
          <p className="dim">Removed blocks are unplugged, not wiped — your logs are untouched.</p>
        </>
      )}

      {sheetOpen && (
        <div className="sheet" role="dialog" aria-label="Add block">
          {Object.values(BLOCKS).map((def) => (
            <button key={def.id} disabled={installed.has(def.id)}
              style={{ minHeight: 48, width: "100%", textAlign: "left" }}
              onClick={() => { setLayout(addBlock(cfg, pageId, def.id)); setSheetOpen(false); }}>
              <strong>{def.name}</strong>
              {installed.has(def.id) ? " — installed" : ""}
              <div className="dim">{def.desc}</div>
            </button>
          ))}
          <button style={{ minHeight: 48 }} onClick={() => setSheetOpen(false)}>Close</button>
        </div>
      )}
    </section>
  );
}
```

Use the app's existing card/sheet CSS classes if present (check how `IconPicker` / existing bottom sheets are styled) rather than inventing new ones; inline `minHeight: 48` may be dropped where the shared class already guarantees it.

- [ ] **Step 2: Verify**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/Dashboard.tsx
git commit -m "feat: Dashboard component with edit mode and add-block sheet"
```

---

### Task 6: Wire `Today.tsx` to `Dashboard`, verify end-to-end, ship

**Files:**
- Modify: `src/ui/screens/Today.tsx`
- Create (throwaway, deleted before commit): `scripts/demo-dashboard.mjs`

**Interfaces:**
- Consumes: `Dashboard` (Task 5).

- [ ] **Step 1: Slim down Today.tsx**

Keep only chrome, in current order — `Onboarding`, `DailyBoot`, `GigMigration`, `MissedPing`, `GoalBanner`, `XpBar` — then `<Dashboard pageId="home" />`. Delete the now-unused block JSX, fetches, and imports that moved into `blocks.tsx` in Task 4.

- [ ] **Step 2: Full checks**

Run: `npm test && npx tsc --noEmit && npm run build && npm run check:vault && npm run check:offline && npm run check:persist`
Expected: all green (layout rides the existing `kv` export path — no script changes needed).

- [ ] **Step 3: Visual verification (throwaway Playwright)**

Write `scripts/demo-dashboard.mjs` following the existing `scripts/demo-*.mjs` pattern: launch dev server, then — fresh profile shows today's exact layout with no `kv` "layout" row (assert via `indexedDB` eval); enter Reconfig; remove Water; move Mood up; add Weight; Done; reload → order persists. Screenshot after each step; send screenshots to Michael. Delete the script after sign-off.

- [ ] **Step 4: Feature commit + deploy**

```bash
git add -A
git commit -m "feat: custom home dashboard — pinnable blocks (slice 1)"
git push
```

Then deploy per the project's existing deploy flow.

---

## Self-review notes

- Spec coverage (Slice 1): registry ✓ (T4), edit mode add/remove/reorder ✓ (T5), default = today's layout & no write until first edit ✓ (T1/T2), single write path ✓ (T2), extraction work ✓ (T3/T4), Today = banners + Dashboard ✓ (T6), export/vault checks + Playwright demo ✓ (T6). Slice 2 (nav edit, CLASSIFIED, custom pages, reset) is deliberately out — separate plan after Slice 1 ships.
- Types consistent: `LayoutConfig`/`BlockId` defined once in T1, consumed by name everywhere; `setLayout(cfg)` signature identical in T2/T5.
