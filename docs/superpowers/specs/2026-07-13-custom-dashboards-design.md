# Custom dashboards & editable nav — design

2026-07-13. Approved in brainstorming with Michael.

## What this is

Users can build their own pages out of pinnable blocks (the home page is just
the first one), and edit the nav drawer: rename pages, reorder them, group them
into drawers, hide the ones they never use into a CLASSIFIED drawer, and create
new custom pages. All edited in place, all stored in the DB so export and vault
sync cover it.

Ships in two slices:

1. **Slice 1 — dashboard blocks:** block registry, home-page edit mode
   (add/remove/reorder blocks).
2. **Slice 2 — nav & pages:** nav edit mode (rename/reorder/group/hide),
   CLASSIFIED drawer, custom pages, reset-layout escape hatch.

## Non-negotiables baked in

- **Default layout is exactly today's layout.** Nothing is written until the
  first edit; new users see zero of this (ADHD default-path rule).
- **System is excluded from the config entirely** — always visible, always
  last, never renamable or hideable. It's the recovery path.
- **Nothing in this feature can lose data.** Blocks are views over existing
  tables; hiding/deleting pages never touches logs.
- Accessibility: 48px targets, labeled controls, arrow-button reorder (no
  drag-and-drop).

## Data model & storage

One new KV row (`kv` table, key `"layout"`). No Dexie schema bump; export and
vault already cover `kv`. Absent row = default config, derived at read time.

```ts
type BlockId =
  | "directives" | "water" | "gigs" | "mood" | "highlight"
  | "goalsPanel" | "weight" | "volume" | "breathing"; // extensible

interface LayoutPage {          // a dashboard
  id: string;                   // "home" | uuid for custom pages
  blocks: BlockId[];            // ordered
}

interface NavEntry {
  id: string;                   // "home" | "training" | "bio" | "feed" | "goals" | "telemetry" | page uuid
  kind: "page" | "screen";      // dashboard vs built-in screen
  label?: string;               // rename override; absent = default name
  glyph?: string;
  group?: string;               // drawer name ("Grind", user-created…)
  hidden?: boolean;             // true → lives in CLASSIFIED
}

interface LayoutConfig {
  pages: LayoutPage[];
  nav: NavEntry[];              // ordered, flat; drawers derived from `group`
}
```

Decisions:

- Flat nav list with a `group` string, not nested trees — one level of
  grouping, matching the existing Grind drawer. The Grind drawer becomes the
  default `group: "Grind"` on Training/Bio/Feed/Goals, editable like any other.
- CLASSIFIED is derived (`hidden: true` entries), not a stored group — nothing
  can get lost in a malformed structure.
- A block may appear on multiple pages (same live data, so it's free). Once
  per page.
- Deleting a custom page drops its `LayoutPage` + `NavEntry`. Deleting a
  drawer ungroups its members.
- `?go=` deep links keep working: they target screens, which exist even when
  hidden (deep-linking to a hidden screen shows it one-off).

## Block registry

`src/ui/blocks.ts`:

```ts
interface BlockDef {
  id: BlockId;
  name: string;                    // picker label
  desc: string;                    // one-line picker description
  Component: () => JSX.Element;    // fully self-contained
}
export const BLOCKS: Record<BlockId, BlockDef>;
```

**Contract: a block takes no props.** It uses `useDayKey()` / `useSettings()`
and fetches its own data with `useLiveQuery`. Extraction work:

- **directives** — extract the ~55-line inline card from `Today.tsx`
  (including editor state and the empty-state "Install grounding protocol")
  into `components/DirectivesCard.tsx`, unchanged.
- **water** — `WaterGauge` keeps its props; a thin `WaterBlock` wrapper does
  the fetching Today currently does.
- **gigs / mood / highlight / goalsPanel** — already take only `today`;
  3-line wrappers each.
- **weight** — `WeightChart` (already self-contained) + the quick-log entry
  from Bio.
- **volume** — `VolumeChart` with a `today` wrapper.
- **breathing** — launcher card that opens `BreathingOverlay`.
- **Excluded from v1: FocusTimer** — needs a specific `habit`, launched from
  HabitCard; not dashboard-shaped. Revisit as a "quick actions" block if
  missed.

**Not blocks (app chrome, pinned above the home dashboard, not configurable):**
`Onboarding`, `DailyBoot`, `GigMigration`, `MissedPing`, `GoalBanner`, `XpBar`.
Making them pinnable just creates ways to lose the XP bar.

`Today.tsx` becomes: banners + `<Dashboard pageId="home" />`. `Dashboard` maps
the page's `blocks[]` over the registry.

## Edit-mode UX

**Dashboard edit mode.** One header button (glyph ⧉, label "Reconfig") flips
the page: each block grows a slim toolbar — ▲ ▼ (move), ✕ (remove) — 48px
targets, block content inert while editing. "+ Add block" opens a bottom sheet
listing the registry (name + one-liner; already-installed blocks marked).
"Done" exits. Remove copy: "unplugged, not wiped" — data untouched.

**Nav edit mode.** "Reconfig" button in the drawer footer. Each entry (except
System) gets:

- ▲ ▼ reorder within its group
- rename — tap label, inline input; blank reverts to default
- hide — moves to CLASSIFIED
- group — small list: existing drawers, "New drawer…", "No drawer"
- "+ New page" — name + glyph (curated set, IconPicker pattern), creates an
  empty dashboard and opens it in edit mode ("Add block" is the first thing
  seen)
- custom pages get delete (confirmation; copy states logged data survives)

**CLASSIFIED.** When anything is hidden, a collapsed `▸ CLASSIFIED` drawer
appears at the bottom of the nav (above Telemetry/System), styled redacted.
Expanding shows hidden pages; tapping opens one one-off (hiding never locks
you out). Unhide button in edit mode. Empty → the drawer doesn't render.

**Escape hatch.** System screen gets "Reset layout to default" with a
confirmation (discards custom pages' layouts, never logged data).

All copy passes the house copy test: kind at 11pm, mechanic named positively,
clear with zero slang, at most one StreetSlang term per string.

## Testing & verification

- **Pure layout logic in `src/ui/layout.ts`** (default derivation, add/remove/
  move block, hide/unhide, group, rename, delete page, reset) with colocated
  `layout.test.ts` (vitest). UI config, not engine — but engine-grade tests
  because it can eat someone's layout.
- **Single write path:** layout KV row written only via `setLayout()` in
  `src/db/repo.ts`.
- **Export/vault:** no new table → covered for free; verified with the
  existing `check:vault`, `check:offline`, `check:persist` scripts.
- **Visual verification:** throwaway Playwright script (`scripts/demo-*.mjs`
  pattern, deleted after) drives the real flow — edit mode, remove Water,
  reorder Mood, add Weight, create a custom page, hide Feed, confirm
  CLASSIFIED, reload for persistence — screenshots sent to Michael at each
  step.
- Each slice: `npm test && npm run build` green → one feature commit → push →
  deploy.
