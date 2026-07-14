# Custom Dashboards Slice 2 — Nav & Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Config-driven nav drawer with edit mode (rename/reorder/group/hide), a derived CLASSIFIED drawer for hidden entries, user-created custom dashboard pages, and a reset-layout escape hatch in System.

**Architecture:** Slice 1 already stores `LayoutConfig` (pages + flat `nav: NavEntry[]`) in the `kv` row `"layout"` with a single write path (`setLayout` in `src/db/repo.ts`). Slice 2 adds pure nav/page operations to `src/ui/layout.ts` (vitest-tested), rewrites `src/ui/Nav.tsx` to render from config with an in-drawer edit mode, teaches `src/ui/App.tsx` to route custom page uuids to `<Dashboard pageId>`, and adds a reset card to System.

**Tech Stack:** React 18 + TypeScript (strict), Dexie (`kv` table, no schema bump), vitest, Playwright for the throwaway demo script.

## Global Constraints (from the design spec — apply to every task)

- Default layout is exactly today's layout; nothing is written to the DB until the first edit.
- **System is excluded from the layout config entirely** — always visible, always last, never renamable/hideable/reorderable.
- Nothing here can lose logged data: hiding/deleting pages never touches logs; delete copy must say logged data survives.
- Accessibility: 48px min targets, labeled controls, arrow-button reorder — **no drag-and-drop**.
- Layout KV row is written **only** via `setLayout()` in `src/db/repo.ts`.
- CLASSIFIED is **derived** from `hidden: true` entries — never a stored group.
- `?go=` deep links keep working; deep-linking to a hidden screen shows it one-off.
- Copy passes the house copy test: kind at 11pm, mechanic named positively, at most one StreetSlang term per string.
- Every task ends green: `npx tsc --noEmit && npm test` before each commit.

## File Structure

- `src/ui/layout.ts` — add nav/page pure ops + `NAV_DEFAULTS` (grows ~90 lines; stays the single home of layout logic).
- `src/ui/layout.test.ts` — colocated tests for every new op.
- `src/ui/Nav.tsx` — rewritten: renders from `useLayout()`; view mode + edit mode + CLASSIFIED + new-page/delete flows. Nav-only concerns stay here.
- `src/ui/App.tsx` — `tab` becomes `string`; routes screen ids and custom page uuids.
- `src/ui/screens/System.tsx` — new "Layout" card with reset.
- No repo/db changes (Slice 1's `setLayout`/`getLayout` suffice).

---

### Task 1: Nav entry operations (rename / hide / group / move) in layout.ts

**Files:**
- Modify: `src/ui/layout.ts` (append after `moveBlock`, line 63)
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: existing `LayoutConfig`, `NavEntry`, `defaultLayout()` from `src/ui/layout.ts`.
- Produces (later tasks import these exact names from `./layout`):
  - `NAV_DEFAULTS: Record<string, { label: string; glyph: string }>`
  - `navLabel(e: NavEntry): string`, `navGlyph(e: NavEntry): string`
  - `renameNavEntry(cfg, id, label: string): LayoutConfig`
  - `setNavHidden(cfg, id, hidden: boolean): LayoutConfig`
  - `setNavGroup(cfg, id, group: string | undefined): LayoutConfig`
  - `moveNavEntry(cfg, id, dir: -1 | 1): LayoutConfig`
  - `visibleNav(cfg): NavEntry[]`, `hiddenNav(cfg): NavEntry[]`

- [ ] **Step 1: Write the failing tests** — append to `src/ui/layout.test.ts`:

```ts
import {
  defaultLayout, addBlock, removeBlock, moveBlock,
  NAV_DEFAULTS, navLabel, navGlyph, renameNavEntry, setNavHidden,
  setNavGroup, moveNavEntry, visibleNav, hiddenNav,
} from "./layout";

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
```

- [ ] **Step 2: Run to verify failure** — `npm test -- layout` → FAIL (named exports missing).
- [ ] **Step 3: Implement** — append to `src/ui/layout.ts`:

```ts
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
    .map((n, idx) => idx)
    .filter((idx) => (nav[idx].group ?? "") === (me.group ?? "") && !!nav[idx].hidden === !!me.hidden);
  const pos = sibIdx.indexOf(i);
  const j = pos + dir;
  if (j < 0 || j >= sibIdx.length) return cfg;
  const next = [...nav];
  [next[i], next[sibIdx[j]]] = [next[sibIdx[j]], next[i]];
  return { ...cfg, nav: next };
}
```

- [ ] **Step 4: Run tests** — `npm test -- layout` → PASS. Also `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git add src/ui/layout.ts src/ui/layout.test.ts && git commit -m "feat: nav entry ops (rename/hide/group/move) in layout logic"`

---

### Task 2: Page operations (addPage / deletePage) in layout.ts

**Files:**
- Modify: `src/ui/layout.ts` (append after Task 1's code)
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: Task 1's ops; existing `LayoutPage`, `NavEntry`.
- Produces:
  - `addPage(cfg, name: string, glyph: string): { cfg: LayoutConfig; id: string }` — uuid page with empty `blocks`, nav entry appended at end.
  - `deletePage(cfg, id: string): LayoutConfig` — drops `LayoutPage` + `NavEntry`; refuses `"home"` and screen ids.

- [ ] **Step 1: Write the failing tests** — append to `src/ui/layout.test.ts` (extend the import list with `addPage, deletePage`):

```ts
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
```

- [ ] **Step 2: Run to verify failure** — `npm test -- layout` → FAIL.
- [ ] **Step 3: Implement** — append to `src/ui/layout.ts`:

```ts
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
```

- [ ] **Step 4: Run tests** — `npm test -- layout` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git add src/ui/layout.ts src/ui/layout.test.ts && git commit -m "feat: custom page add/delete in layout logic"`

---

### Task 3: Config-driven Nav (view mode) + string routing + CLASSIFIED drawer

**Files:**
- Modify: `src/ui/Nav.tsx` (full rewrite of render, keep `useOnline`, Escape handling, footer)
- Modify: `src/ui/App.tsx` (`tab: string`, custom page route)

**Interfaces:**
- Consumes: `useLayout()` from `src/ui/useLayout.ts`; `visibleNav`, `hiddenNav`, `navLabel`, `navGlyph`, type `NavEntry` from `./layout`; `Dashboard` from `./components/Dashboard`.
- Produces: `Nav` props become `{ open: boolean; tab: string; onChange: (t: string) => void; onClose: () => void }`. Export `type Tab = string` (kept so existing imports compile). Nav entry id `"home"` maps to tab `"directives"`; every other entry's tab is its `id`.

**Behavior spec:**
- Render `visibleNav(cfg)` in array order. Grouped entries render inside a collapsible drawer anchored at the first member's position (walk the list; when hitting a grouped entry whose group hasn't rendered yet, render the drawer header + all members of that group, in list order). Collapse state per drawer: `localStorage` key `` `nav-drawer-open:${name}` `` (default open; the old `nav-grind-open` key is superseded — cosmetic, no migration).
- After all visible entries: if `hiddenNav(cfg).length > 0`, render a collapsed `▸ CLASSIFIED` drawer (className `nav-group classified`, default **closed**, state in component `useState` only — always reopens collapsed). Expanding lists hidden entries; tapping one navigates one-off (`onChange(tabFor(e))`) without unhiding. Empty → not rendered at all.
- System stays hardcoded after CLASSIFIED, exactly as today. Divider placement: divider before Telemetry group is dropped (nav is now dynamic); keep one divider before the System row.

- [ ] **Step 1: Rewrite `src/ui/Nav.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { useLayout } from "./useLayout";
import { visibleNav, hiddenNav, navLabel, navGlyph, type NavEntry } from "./layout";

export type Tab = string;

const VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

function useOnline() { /* unchanged from current file, lines 17-30 */ }

const tabFor = (e: NavEntry) => (e.id === "home" ? "directives" : e.id);

function useDrawerOpen(name: string) {
  const key = `nav-drawer-open:${name}`;
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== "0");
  return [open, () => { localStorage.setItem(key, open ? "0" : "1"); setOpen(!open); }] as const;
}

function DrawerSection({ name, entries, navBtn }: {
  name: string; entries: NavEntry[]; navBtn: (e: NavEntry, sub?: boolean) => JSX.Element;
}) {
  const [open, toggle] = useDrawerOpen(name);
  return (
    <>
      <button className="nav-group" onClick={toggle} aria-expanded={open}>
        <span className="glyph" aria-hidden="true">◢</span>
        {name}
        <span className="nav-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && entries.map((e) => navBtn(e, true))}
    </>
  );
}

export function Nav({ open, tab, onChange, onClose }: {
  open: boolean; tab: string; onChange: (t: string) => void; onClose: () => void;
}) {
  const online = useOnline();
  const cfg = useLayout();
  const [classifiedOpen, setClassifiedOpen] = useState(false);

  useEffect(() => { /* Escape-to-close, unchanged from current file lines 57-64 */ }, [open, onClose]);
  if (!open) return null;

  const navBtn = (e: NavEntry, sub = false) => (
    <button key={e.id} className={sub ? "nav-sub" : undefined}
      onClick={() => { onChange(tabFor(e)); onClose(); }}
      aria-current={tab === tabFor(e) ? "page" : undefined}>
      <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
      {navLabel(e)}
    </button>
  );

  // Entries in order; a drawer renders at its first member's position.
  const vis = visibleNav(cfg);
  const rendered = new Set<string>();
  const rows: JSX.Element[] = [];
  for (const e of vis) {
    if (!e.group) { rows.push(navBtn(e)); continue; }
    if (rendered.has(e.group)) continue;
    rendered.add(e.group);
    const members = vis.filter((m) => m.group === e.group);
    rows.push(<DrawerSection key={`g:${e.group}`} name={e.group} entries={members} navBtn={navBtn} />);
  }

  const hidden = hiddenNav(cfg);

  return (
    <div className="nav-overlay" onClick={onClose}>
      <nav className="nav-drawer" aria-label="Main" onClick={(ev) => ev.stopPropagation()}>
        <div className="nav-drawer-title">CYBER<span className="slash">//</span>FIT</div>
        {rows}
        {hidden.length > 0 && (
          <>
            <button className="nav-group classified" onClick={() => setClassifiedOpen(!classifiedOpen)}
              aria-expanded={classifiedOpen}>
              <span className="glyph" aria-hidden="true">▚</span>
              CLASSIFIED
              <span className="nav-caret" aria-hidden="true">{classifiedOpen ? "▾" : "▸"}</span>
            </button>
            {classifiedOpen && hidden.map((e) => navBtn(e, true))}
          </>
        )}
        <div className="nav-divider" role="separator" />
        <button onClick={() => { onChange("system"); onClose(); }}
          aria-current={tab === "system" ? "page" : undefined}>
          <span className="glyph" aria-hidden="true">⚙</span>
          System
        </button>
        <div className="nav-footer">
          <span>v{VERSION}</span>
          <span className={online ? "status-chip" : "status-chip offgrid"}>
            {online ? "LINKED" : "OFF-GRID"}
          </span>
        </div>
      </nav>
    </div>
  );
}
```

(Where a step says "unchanged from current file", copy those lines verbatim from the existing `Nav.tsx` — they are the `useOnline` hook body and the Escape-key effect.)

- [ ] **Step 2: Route custom pages in `src/ui/App.tsx`** — change line 39 to `const [tab, setTab] = useState<string>("directives");`, add imports `import { Dashboard } from "./components/Dashboard.tsx";` and `import { useLayout } from "./useLayout.ts";`, add `const layout = useLayout();` inside `App`, and replace the `<main>` block (lines 87-96) with:

```tsx
      <main className="screen">
        <InstallPrompt />
        {tab === "directives" && <Today />}
        {tab === "training" && <Training />}
        {tab === "bio" && <Bio />}
        {tab === "feed" && <Feed />}
        {tab === "goals" && <Goals />}
        {tab === "telemetry" && <Stats />}
        {tab === "system" && <System />}
        {layout.pages.some((p) => p.id === tab) && <Dashboard pageId={tab} />}
      </main>
```

(`"home"` never appears as a tab value — entry id `"home"` maps to `"directives"` — so the Dashboard route only matches custom uuids. `?go=` handling at lines 52-59 is untouched and still lands on screens even when hidden: routing never consults `hidden`.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm test` → green. `npm run dev`, open drawer: identical structure to before (Directives, Grind drawer with 4 items, Telemetry, System, footer).
- [ ] **Step 4: Commit** — `git add src/ui/Nav.tsx src/ui/App.tsx && git commit -m "feat: nav drawer renders from layout config with CLASSIFIED and custom page routing"`

---

### Task 4: Nav edit mode (reorder / rename / hide / group / unhide)

**Files:**
- Modify: `src/ui/Nav.tsx`

**Interfaces:**
- Consumes: `renameNavEntry`, `setNavHidden`, `setNavGroup`, `moveNavEntry`, `visibleNav`, `hiddenNav`, `navLabel`, `navGlyph` from `./layout`; `setLayout` from `../db/repo`; `useLayout`.
- Produces: nothing new for later tasks; Task 5 adds its buttons into the edit UI built here.

**Behavior spec:**
- "⧉ Reconfig" button in the drawer footer (48px target) toggles `editing`. Label flips to "Done". Editing state resets when the drawer closes.
- While editing, each entry row (visible and CLASSIFIED members; **System excluded**) renders controls instead of navigating:
  - ▲ ▼ → `setLayout(moveNavEntry(cfg, e.id, ∓1))`, disabled at group edges (compute the same sibling list as `moveNavEntry` to disable).
  - Label tap → inline `<input>` (autofocus, `aria-label` "Rename <default name>"); commit on blur/Enter via `setLayout(renameNavEntry(cfg, e.id, value))`. Blank reverts to default — placeholder shows the default name.
  - "Stash" button (visible entries) → `setLayout(setNavHidden(cfg, e.id, true))`. "Restore" button (CLASSIFIED entries) → `setNavHidden(cfg, e.id, false)`.
  - "Drawer…" button → small inline list: each existing drawer name (from `new Set(visibleNav(cfg).map(e => e.group).filter(Boolean))`), "New drawer…" (inline text input, commit on Enter), "No drawer" → `setLayout(setNavGroup(cfg, e.id, choice))`.
- While editing, drawers render expanded regardless of collapse state, and CLASSIFIED renders expanded with its members' Restore controls; helper copy under the list: `"Stashed pages wait in CLASSIFIED — nothing is deleted."`
- All buttons `style={{ minHeight: 48, minWidth: 48 }}` (match `Dashboard.tsx` pattern).

- [ ] **Step 1: Implement** — inside `Nav`, add:

```tsx
const [editing, setEditing] = useState(false);
const [renaming, setRenaming] = useState<string | null>(null);   // entry id
const [grouping, setGrouping] = useState<string | null>(null);   // entry id
const [newDrawer, setNewDrawer] = useState("");
```

Edit row (replaces `navBtn` when `editing`):

```tsx
const editRow = (e: NavEntry, inClassified = false) => {
  const sibs = (inClassified ? hidden : vis).filter(
    (m) => (m.group ?? "") === (e.group ?? ""));
  const pos = sibs.findIndex((m) => m.id === e.id);
  const drawers = [...new Set(vis.map((m) => m.group).filter((g): g is string => !!g))];
  return (
    <div key={e.id} className="nav-edit-row">
      <span className="glyph" aria-hidden="true">{navGlyph(e)}</span>
      {renaming === e.id ? (
        <input autoFocus defaultValue={e.label ?? ""} placeholder={navLabel({ ...e, label: undefined })}
          aria-label={`Rename ${navLabel(e)}`}
          onBlur={(ev) => { setLayout(renameNavEntry(cfg, e.id, ev.target.value)); setRenaming(null); }}
          onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
      ) : (
        <button style={{ minHeight: 48, flex: 1, textAlign: "left" }}
          aria-label={`Rename ${navLabel(e)}`} onClick={() => setRenaming(e.id)}>
          {navLabel(e)}
        </button>
      )}
      <button aria-label={`Move ${navLabel(e)} up`} disabled={pos <= 0}
        style={{ minHeight: 48, minWidth: 48 }}
        onClick={() => setLayout(moveNavEntry(cfg, e.id, -1))}>▲</button>
      <button aria-label={`Move ${navLabel(e)} down`} disabled={pos === sibs.length - 1}
        style={{ minHeight: 48, minWidth: 48 }}
        onClick={() => setLayout(moveNavEntry(cfg, e.id, 1))}>▼</button>
      {inClassified ? (
        <button aria-label={`Restore ${navLabel(e)}`} style={{ minHeight: 48 }}
          onClick={() => setLayout(setNavHidden(cfg, e.id, false))}>Restore</button>
      ) : (
        <>
          <button aria-label={`Stash ${navLabel(e)} in CLASSIFIED`} style={{ minHeight: 48 }}
            onClick={() => setLayout(setNavHidden(cfg, e.id, true))}>Stash</button>
          <button aria-label={`Choose drawer for ${navLabel(e)}`} style={{ minHeight: 48 }}
            onClick={() => setGrouping(grouping === e.id ? null : e.id)}>Drawer…</button>
        </>
      )}
      {grouping === e.id && (
        <div role="group" aria-label={`Drawer options for ${navLabel(e)}`} className="nav-group-pick">
          {drawers.map((g) => (
            <button key={g} style={{ minHeight: 48 }}
              onClick={() => { setLayout(setNavGroup(cfg, e.id, g)); setGrouping(null); }}>{g}</button>
          ))}
          <input placeholder="New drawer…" aria-label="New drawer name" value={newDrawer}
            onChange={(ev) => setNewDrawer(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && newDrawer.trim()) {
                setLayout(setNavGroup(cfg, e.id, newDrawer)); setNewDrawer(""); setGrouping(null);
              }
            }} />
          <button style={{ minHeight: 48 }}
            onClick={() => { setLayout(setNavGroup(cfg, e.id, undefined)); setGrouping(null); }}>No drawer</button>
        </div>
      )}
    </div>
  );
};
```

Wire it up: when `editing`, build `rows` with `editRow(e)` for every visible entry (grouped entries render under a plain, non-collapsible drawer heading `<div className="nav-group" aria-hidden="true">…</div>` while editing), render CLASSIFIED expanded with `hidden.map((e) => editRow(e, true))`, and render in the footer area:

```tsx
<button style={{ minHeight: 48, width: "100%" }}
  aria-label={editing ? "Done reconfiguring nav" : "Reconfig nav"}
  onClick={() => { setEditing(!editing); setRenaming(null); setGrouping(null); }}>
  {editing ? "Done" : "⧉ Reconfig"}
</button>
{editing && <p className="dim">Stashed pages wait in CLASSIFIED — nothing is deleted.</p>}
```

Also reset `editing` when the drawer closes: `useEffect(() => { if (!open) { setEditing(false); setRenaming(null); setGrouping(null); } }, [open]);` — place this **before** the `if (!open) return null;` early return (hooks order).

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm test` green. Manual: rename Training → blank reverts; hide Feed → appears in CLASSIFIED; move Bio up; new drawer "Lab" for Telemetry; all persists across reload.
- [ ] **Step 3: Commit** — `git add src/ui/Nav.tsx && git commit -m "feat: nav edit mode — rename, reorder, group, stash to CLASSIFIED"`

---

### Task 5: "+ New page" flow and custom-page delete

**Files:**
- Modify: `src/ui/Nav.tsx`

**Interfaces:**
- Consumes: `addPage`, `deletePage` from `./layout`; `IconPicker` from `./components/IconPicker` (props `{ icon: string; onPick: (icon: string) => void }`); `setLayout`; Nav's `onChange`/`onClose`.
- Produces: complete Slice 2 nav UI.

**Behavior spec:**
- In edit mode, below the entry rows: `+ New page` button (48px) → inline form: name `<input aria-label="Page name">` + `<IconPicker icon={glyph} onPick={setGlyph} />` (default glyph `"⚡"`) + Create/Cancel. Create → `const { cfg: next, id } = addPage(cfg, name, glyph); await setLayout(next); onChange(id); onClose();` — landing on the empty dashboard whose only affordance is "⧉ Reconfig" → "+ Add block" (design: add-block is the first thing seen; acceptable that one tap opens edit mode — Dashboard's empty page shows the Reconfig header button).
- Custom pages (`e.kind === "page" && e.id !== "home"`) get a Delete button in their edit row → two-step confirm (button flips to "Confirm delete", second tap runs `setLayout(deletePage(cfg, e.id))`; if the deleted page is the current `tab`, also `onChange("directives")`). Copy next to confirm: `"Deletes the page layout only — every log you recorded survives."`

- [ ] **Step 1: Implement** — add state `const [newPage, setNewPage] = useState<{ name: string; glyph: string } | null>(null);` and `const [confirmDelete, setConfirmDelete] = useState<string | null>(null);`. New-page form under the edit rows:

```tsx
{newPage ? (
  <div className="nav-new-page">
    <input autoFocus aria-label="Page name" placeholder="Page name" value={newPage.name}
      onChange={(ev) => setNewPage({ ...newPage, name: ev.target.value })} />
    <IconPicker icon={newPage.glyph} onPick={(g) => setNewPage({ ...newPage, glyph: g })} />
    <button style={{ minHeight: 48 }} onClick={async () => {
      const { cfg: next, id } = addPage(cfg, newPage.name, newPage.glyph);
      await setLayout(next);
      setNewPage(null); onChange(id); onClose();
    }}>Create</button>
    <button style={{ minHeight: 48 }} onClick={() => setNewPage(null)}>Cancel</button>
  </div>
) : (
  <button style={{ minHeight: 48, width: "100%" }}
    onClick={() => setNewPage({ name: "", glyph: "⚡" })}>+ New page</button>
)}
```

Delete control inside `editRow` for custom pages (after the Drawer… button, only when `e.kind === "page" && e.id !== "home"`):

```tsx
<button aria-label={`Delete ${navLabel(e)}`} style={{ minHeight: 48 }}
  onClick={() => {
    if (confirmDelete !== e.id) { setConfirmDelete(e.id); return; }
    setLayout(deletePage(cfg, e.id));
    setConfirmDelete(null);
    if (tab === e.id) onChange("directives");
  }}>
  {confirmDelete === e.id ? "Confirm delete" : "Delete"}
</button>
{confirmDelete === e.id && (
  <p className="dim">Deletes the page layout only — every log you recorded survives.</p>
)}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm test` green. Manual: create "Recovery" 🌙 → lands on empty dashboard → add Weight block → nav shows 🌙 Recovery → delete it (two-tap) → back on Directives, Weight logs intact in Bio.
- [ ] **Step 3: Commit** — `git add src/ui/Nav.tsx && git commit -m "feat: custom pages — create from nav, delete with confirmation"`

---

### Task 6: Reset-layout escape hatch in System

**Files:**
- Modify: `src/ui/screens/System.tsx` (add a card inside the `<section aria-label="System">`, after the Config card ending ~line 520, before `</section>` at line 549)

**Interfaces:**
- Consumes: `setLayout` from `../../db/repo`; `defaultLayout` from `../layout`.
- Produces: recovery path required by the design's non-negotiables.

- [ ] **Step 1: Implement** — add to `System.tsx` (imports at top, card in JSX, `resetArmed` state via `useState(false)` alongside System's existing state):

```tsx
<div className="card">
  <h2 className="card-title">Layout</h2>
  <p className="dim">Rebuilds the stock dashboard and nav. Custom pages' layouts are discarded — your logged data is untouched.</p>
  {resetArmed ? (
    <div role="group" aria-label="Confirm layout reset">
      <button style={{ minHeight: 48 }}
        onClick={async () => { await setLayout(defaultLayout()); setResetArmed(false); }}>
        Confirm reset
      </button>
      <button style={{ minHeight: 48 }} onClick={() => setResetArmed(false)}>Cancel</button>
    </div>
  ) : (
    <button style={{ minHeight: 48 }} onClick={() => setResetArmed(true)}>
      Reset layout to default
    </button>
  )}
</div>
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm test` green. Manual: mangle the layout (hide Feed, custom page, renamed Training), reset → drawer back to stock, custom page gone, all logs intact.
- [ ] **Step 3: Commit** — `git add src/ui/screens/System.tsx && git commit -m "feat: reset-layout escape hatch in System"`

---

### Task 7: Slice verification — checks, styles, demo, ship

**Files:**
- Modify: `src/ui/theme/tokens.css` (nav edit/CLASSIFIED styles if any selector used above is missing)
- Create (then delete): `scripts/demo-nav.mjs` (throwaway, follows the deleted `scripts/demo-dashboard.mjs` pattern from Slice 1: launch `npm run dev`, drive Chromium via Playwright, screenshot to `/tmp`)

**Interfaces:**
- Consumes: everything above.
- Produces: shipped Slice 2.

- [ ] **Step 1: Styles** — grep `tokens.css` for `nav-edit-row`, `nav-group-pick`, `nav-new-page`, `classified`; add minimal rules for any missing (flex row, gap 8px, `.classified { color: var(--text-dim); letter-spacing: 2px; }` redacted look consistent with theme vars).
- [ ] **Step 2: Full gates** — `npm test && npx tsc --noEmit && npm run build` all green; run `npm run check:vault && npm run check:offline && npm run check:persist` (layout rides the existing `kv` coverage — these must stay green with a populated layout row).
- [ ] **Step 3: Visual verification** — write `scripts/demo-nav.mjs` driving the real flow: open drawer → Reconfig → rename Training→"Ops" → move Bio up → hide Feed → confirm CLASSIFIED appears → new drawer "Lab" for Telemetry → + New page "Recovery" 🌙 → add Weight block → reload → confirm persistence → System reset → confirm stock. Screenshot each step to `/tmp/demo-nav-NN.png`, send to Michael for review, then `rm scripts/demo-nav.mjs`.
- [ ] **Step 4: Ship** — single feature commit already accumulated per-task; push and deploy exactly as Slice 1 (`git push` → deploy step from the project's release flow).

---

## Self-Review (done at write time)

- **Spec coverage:** rename (T1/T4), reorder arrow-buttons (T1/T4), group + new drawer + ungroup (T1/T4), hide/CLASSIFIED derived + one-off open + unhide (T1/T3/T4), custom pages create/delete + empty-dashboard landing (T2/T5), reset hatch (T6), System excluded everywhere (T3 hardcodes it outside config), `?go=` untouched (T3 step 2), single write path preserved (all writes via `setLayout`), no data loss + copy (T4/T5/T6), 48px/labels/no-DnD (T4/T5/T6), demo + checks + ship (T7). Drawer-delete = ungroup members falls out of `setNavGroup` (no stored drawer object) — matches design decision.
- **Placeholder scan:** the two "unchanged from current file" callouts reference exact existing line ranges — acceptable as verbatim-copy instructions, not gaps.
- **Type consistency:** `setLayout(cfg)` promise-returning; ops all `(cfg, …) => LayoutConfig` except `addPage` returning `{ cfg, id }` — consistent across T2/T5.
