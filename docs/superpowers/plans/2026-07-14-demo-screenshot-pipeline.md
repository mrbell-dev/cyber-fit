# Demo Screenshot Pipeline — Implementation Plan

- **Date:** 2026-07-14
- **Spec:** `docs/superpowers/specs/2026-07-14-demo-screenshot-pipeline-design.md`
- **Status:** ready for execution

## Goal

A repeatable pipeline that produces a "lived-in" set of mobile screenshots for the
user guide: a fictional 3-week demo profile is generated as a real cyber-fit backup
JSON, imported through the app's actual System → Import backup path in a headless
browser, and every screen is captured to `docs/guide/img/*.png` at 390×844. Demo
profile JSON is also committed at `docs/guide/demo-profile.json` so a human can
import it manually.

## Ground truth (verified against source, 2026-07-14)

| Fact | Where |
|---|---|
| `EXPORT_VERSION = 9`; export shape `{ app: "cyber-fit", schemaVersion, exportedAt, tables }` with 17 tables: habits, habitLogs, waterLogs, moodLogs, workoutLogs, readingItems, readingLogs, highlightLogs, bodyLogs, journalLogs, gigs, bioMetrics, bioReadings, screenings, goals, tombstones, kv | `src/db/export.ts` |
| `importJson` clears all tables, `bulkAdd`s file rows, then `refreshPlayer()` rebuilds derived state; success toast: `"Backup restored — player state rebuilt from logs."` | `src/db/export.ts` |
| Row shapes (`Habit` requires `id,name,icon,schedule,domain,target,createdAt,order`; all log rows carry `id,dayKey,ts`; `Schedule` kinds `daily/weekdays/timesPerWeek/nPerX`; `Goal.source` kinds `habits/readingPages/workouts`; `Screening.tool` `phq9/gad7`) | `src/engine/types.ts` |
| `dayKeyFor(ts, tzOffsetMinutes, dayStartHour)` — pure, no imports; default day start hour is 3 | `src/engine/time.ts` |
| ids are `crypto.randomUUID()`; settings live in `kv` under key `"settings"` (overrides merged over `DEFAULT_SETTINGS` on read — confirm the merge in the loader around `src/db/repo.ts:62–69` while implementing) | `src/db/repo.ts` |
| Onboarding buttons: **Begin calibration** → **Next** → **Jack in**; hidden when `kv.onboarded` or any habits exist; `kv.lastBootDay` suppresses the daily boot popup | `src/ui/components/Onboarding.tsx` |
| Import UI: visible "Import backup" button + hidden `<input type="file" aria-label="Import backup file">` | `src/ui/screens/System.tsx:388–395` |
| Nav: header button `aria-label="Open menu"`; drawer is `role=navigation` named "Main"; labels **Directives, Training, Bio, Feed, Goals, Telemetry** (+ **System**); crash kit button `aria-label="Open crash kit"` | `src/ui/layout.ts:67–74`, `src/ui/App.tsx:71,82`, `scripts/persist-check.mjs:46–47` |
| Vitest: `environment: "node"`, include `src/**/*.test.ts(x)` only — the seed test must live under `src/` | `vite.config.ts` |
| Node is v26.4.0 → native TS type-stripping; a plain-node `.mjs` script can `import ... from "../src/engine/time.ts"` | `node -v` |
| Ports already claimed: `shoot.mjs` → 4173, `persist-check.mjs` → 4174. This pipeline uses **4179** | `scripts/` |

## Constraints (from the spec)

- Mobile only: 390×844, `deviceScaleFactor: 2`, `reducedMotion: "reduce"`.
- All data fictional. No real people, no real health data. Cyberpunk-flavored but plausible.
- dayKeys computed with the app's own `dayKeyFor` — never reimplemented.
- Demo profile flows through the real import path — no direct IndexedDB writes.
- Deterministic filenames `NN-name.png`; never touch the existing `shots/` marketing pipeline.
- Streak texture: at least one 1-day gap mid-streak (shield absorb) and one ≥3-day gap
  followed by resumption (reboot arc) — recovery must look normal, not shameful.

---

## Task 1 — Seed module + schema-drift test

### Step 1.1 — Write the failing test

Create `src/db/seed-demo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXPORT_VERSION } from "./export.ts";
import { dayKeyFor } from "../engine/time.ts";
// Plain-JS node script — no declaration file, vitest doesn't typecheck.
// @ts-expect-error
import { buildDemoExport, SEED_SCHEMA_VERSION } from "../../scripts/seed-demo.mjs";

const TABLES = [
  "habits", "habitLogs", "waterLogs", "moodLogs", "workoutLogs",
  "readingItems", "readingLogs", "highlightLogs", "bodyLogs", "journalLogs",
  "gigs", "bioMetrics", "bioReadings", "screenings", "goals", "tombstones", "kv",
] as const;

// Fixed local-time "now" so assertions are stable.
const FIXED_NOW = new Date("2026-07-10T15:00:00").getTime();
const demo = buildDemoExport(FIXED_NOW);

describe("demo profile export", () => {
  it("matches the live export schema version", () => {
    expect(SEED_SCHEMA_VERSION).toBe(EXPORT_VERSION);
    expect(demo.schemaVersion).toBe(EXPORT_VERSION);
    expect(demo.app).toBe("cyber-fit");
  });

  it("contains every export table as an array", () => {
    for (const name of TABLES) {
      expect(Array.isArray(demo.tables[name]), name).toBe(true);
    }
    expect(Object.keys(demo.tables).sort()).toEqual([...TABLES].sort());
  });

  it("uses unique ids everywhere", () => {
    const ids = TABLES.filter((t) => t !== "kv")
      .flatMap((t) => demo.tables[t].map((r: { id: string }) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("computes every dayKey via the engine's dayKeyFor", () => {
    for (const name of TABLES) {
      for (const row of demo.tables[name] as { dayKey?: string; ts?: number }[]) {
        if (row.dayKey === undefined) continue;
        const expected = dayKeyFor(row.ts!, new Date(row.ts!).getTimezoneOffset(), 3);
        expect(row.dayKey).toBe(expected);
      }
    }
  });

  it("keeps referential integrity", () => {
    const habitIds = new Set(demo.tables.habits.map((h: { id: string }) => h.id));
    for (const log of demo.tables.habitLogs) expect(habitIds.has(log.habitId)).toBe(true);
    const itemIds = new Set(demo.tables.readingItems.map((i: { id: string }) => i.id));
    for (const log of demo.tables.readingLogs) expect(itemIds.has(log.itemId)).toBe(true);
    const metricIds = new Set(demo.tables.bioMetrics.map((m: { id: string }) => m.id));
    for (const r of demo.tables.bioReadings) expect(metricIds.has(r.metricId)).toBe(true);
  });

  it("has streak texture: a 1-day gap and a ≥3-day reboot arc", () => {
    // Days-ago offsets each habit was logged "done".
    const byHabit = new Map<string, Set<number>>();
    const dayMs = 86_400_000;
    for (const log of demo.tables.habitLogs) {
      if (log.kind !== "done") continue;
      const off = Math.round((FIXED_NOW - log.ts) / dayMs);
      if (!byHabit.has(log.habitId)) byHabit.set(log.habitId, new Set());
      byHabit.get(log.habitId)!.add(off);
    }
    const gaps = [...byHabit.values()].map((days) => {
      let maxGap = 0;
      for (let d = 0; d < 21; d++) {
        let run = 0;
        while (d + run < 21 && !days.has(d + run)) run++;
        maxGap = Math.max(maxGap, run);
        d += run;
      }
      return maxGap;
    });
    expect(gaps.some((g) => g === 1)).toBe(true);   // shield absorb
    expect(gaps.some((g) => g >= 3)).toBe(true);    // reboot arc
  });

  it("suppresses first-run modals after import", () => {
    const kv = new Map(demo.tables.kv.map((r: { key: string; value: unknown }) => [r.key, r.value]));
    expect(kv.get("onboarded")).toBe(true);
    expect(typeof kv.get("lastBootDay")).toBe("string");
    expect(kv.get("settings")).toBeTruthy();
  });
});
```

Run: `npx vitest run src/db/seed-demo.test.ts` — **expect failure** (module doesn't exist).

Note: this test imports `src/db/export.ts`, which constructs the Dexie instance in
node without opening it — Dexie only requires IndexedDB at `open()`, so this is safe.

### Step 1.2 — Implement `scripts/seed-demo.mjs`

```js
#!/usr/bin/env node
// Demo profile generator — builds a fictional 3-week profile as a cyber-fit
// backup file (the same JSON shape the app's own Export produces). Consumed by
// scripts/shoot-demo.mjs and emitted to docs/guide/demo-profile.json for
// manual "try the demo" imports.
//
// All data is fictional. No real people, no real health data.
// Requires node ≥ 23 (native TS type-stripping for the engine import below).
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dayKeyFor } from "../src/engine/time.ts";

// Must match EXPORT_VERSION in src/db/export.ts — drift is caught by
// src/db/seed-demo.test.ts, which imports both and asserts equality.
export const SEED_SCHEMA_VERSION = 9;

const DAY_START_HOUR = 3; // matches the app's settings default
const DAYS = 21;
const uuid = () => crypto.randomUUID();

/** Local-time timestamp `daysAgo` days before `now`, at hour:min. */
function at(now, daysAgo, hour, min = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d.getTime();
}
const keyOf = (ts) => dayKeyFor(ts, new Date(ts).getTimezoneOffset(), DAY_START_HOUR);
const stamp = (ts) => ({ id: uuid(), dayKey: keyOf(ts), ts });

export function buildDemoExport(now = Date.now()) {
  // ---------- habits: 6 directives with deliberate gap patterns ----------
  // miss = days-ago offsets with no log. "Morning meds" has a single 1-day gap
  // (shield absorb); "Morning stretch" has a 4-day gap then resumes (reboot arc).
  const habitDefs = [
    { name: "Morning meds", icon: "💊", area: "health", timeOfDay: "morning",
      schedule: { kind: "daily" }, hour: 8, miss: [13] },
    { name: "Grounding ritual — 10 min offline", icon: "🧘", area: "grounding",
      presetId: "grounding", schedule: { kind: "daily" }, hour: 21, miss: [2, 9, 15] },
    { name: "Morning stretch", icon: "🦾", area: "body", presetId: "stretch",
      schedule: { kind: "weekdays", days: [1, 2, 3, 4, 5] }, hour: 7, miss: [16, 17, 18, 19] },
    { name: "Feed the wetware — read", icon: "📖", area: "learning", domain: "learning",
      presetId: "read", schedule: { kind: "daily" }, hour: 22, miss: [6] },
    { name: "Eat a real vegetable", icon: "🥗", area: "nutrition", presetId: "veg",
      schedule: { kind: "timesPerWeek", target: 4 }, hour: 18, miss: [1, 4, 8, 11, 12, 16, 19] },
    { name: "Touch grass — walk outside", icon: "🚶", area: "grounding", presetId: "walk",
      schedule: { kind: "daily" }, hour: 12, miss: [3, 10, 17] },
  ];
  const habits = habitDefs.map((h, i) => ({
    id: uuid(), name: h.name, icon: h.icon, schedule: h.schedule,
    domain: h.domain ?? "general", target: 1,
    area: h.area,
    ...(h.timeOfDay ? { timeOfDay: h.timeOfDay } : {}),
    ...(h.presetId ? { presetId: h.presetId } : {}),
    createdAt: at(now, DAYS + 3, 9), order: i,
  }));

  const habitLogs = [];
  habits.forEach((habit, i) => {
    const def = habitDefs[i];
    for (let d = 0; d < DAYS; d++) {
      const ts = at(now, d, def.hour);
      const weekday = new Date(ts).getDay();
      if (def.schedule.kind === "weekdays" && !def.schedule.days.includes(weekday)) continue;
      if (def.miss.includes(d)) continue;
      habitLogs.push({ ...stamp(ts), habitId: habit.id, amount: 1, kind: "done" });
    }
  });
  // One honored rest day recorded as an explicit skip (not a silent gap).
  habitLogs.push({ ...stamp(at(now, 10, 12, 30)), habitId: habits[5].id, amount: 1, kind: "skip" });

  // ---------- water: 5–8 pours of 350 ml per day ----------
  const waterLogs = [];
  for (let d = 0; d < DAYS; d++) {
    const glasses = 5 + ((d * 3) % 4);
    for (let g = 0; g < glasses; g++) {
      waterLogs.push({ ...stamp(at(now, d, 8 + g * 2, 15)), ml: 350 });
    }
  }

  // ---------- mood: daily check-ins, honest range, a rough patch mid-arc ----------
  const ratings = [4, 3, 5, 4, 2, 4, 3, 5, 4, 4, 3, 4, 5, 3, 4, 2, 3, 4, 4, 5, 4];
  const moodNotes = {
    4: "shift ran long — flat all day",
    7: "long ride, head quiet after",
    12: "best day in a while",
    15: "slept 5h, everything is loud",
  };
  const moodLogs = ratings.map((rating, d) => ({
    ...stamp(at(now, d, 20, 30)), rating,
    energy: Math.max(1, rating - (d % 2)),
    ...(moodNotes[d] ? { note: moodNotes[d] } : {}),
  }));

  // ---------- workouts: ~3/week, mixed styles ----------
  const sets = (reps, weight, n = 3) => Array.from({ length: n }, () => ({ reps, weight }));
  const workoutLogs = [
    { d: 1, name: "Push day", style: "sets", durationMin: 48, exercises: [
      { name: "Bench press", sets: sets(5, 135) },
      { name: "Overhead press", sets: sets(8, 75) },
      { name: "Dips", sets: sets(10) },
    ] },
    { d: 3, name: "Zone 2 ride", style: "cardio", durationMin: 52, distance: 12.4,
      note: "kept HR low, felt easy" },
    { d: 6, name: "Leg day", style: "sets", durationMin: 55, exercises: [
      { name: "Squat", sets: sets(5, 185) },
      { name: "Romanian deadlift", sets: sets(8, 155) },
    ] },
    { d: 9, name: "Tempo run", style: "cardio", durationMin: 28, distance: 3.1 },
    { d: 13, name: "Pull day", style: "sets", durationMin: 45, exercises: [
      { name: "Deadlift", sets: sets(5, 225) },
      { name: "Barbell row", sets: sets(10, 95) },
    ] },
    { d: 16, name: "Garage AMRAP", style: "amrap", durationMin: 20, score: "7 rounds + 4" },
    { d: 19, name: "Push day", style: "sets", durationMin: 50, exercises: [
      { name: "Bench press", sets: sets(5, 130) },
      { name: "Overhead press", sets: sets(8, 70) },
    ] },
  ].map(({ d, ...w }) => ({ ...stamp(at(now, d, 17, 30)), ...w }));

  // ---------- reading: one in progress, one recently finished ----------
  const book = { id: uuid(), title: "Neuromancer", author: "William Gibson",
    type: "book", status: "reading", createdAt: at(now, 20, 10) };
  const finished = { id: uuid(), title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin", type: "book", status: "finished",
    createdAt: at(now, 60, 10), finishedAt: at(now, 14, 22) };
  const readingItems = [book, finished];
  const readingLogs = [
    { d: 0, itemId: book.id, minutes: 25, pages: 18, feeling: 4 },
    { d: 1, itemId: book.id, minutes: 30, pages: 22 },
    { d: 3, itemId: book.id, minutes: 20, pages: 15, feeling: 5, note: "chapter 3 goes hard" },
    { d: 5, itemId: book.id, minutes: 35, pages: 26 },
    { d: 8, itemId: book.id, minutes: 15, pages: 11 },
    { d: 12, itemId: book.id, minutes: 40, pages: 30, feeling: 4 },
    { d: 14, itemId: finished.id, minutes: 45, pages: 38, feeling: 5, note: "finished it. wow." },
    { d: 18, itemId: finished.id, minutes: 30, pages: 24 },
  ].map(({ d, ...r }) => ({ ...stamp(at(now, d, 22, 10)), ...r }));

  const highlightLogs = [
    { d: 0, text: "Streaks aren't the point — showing up after a broken one is." },
    { d: 4, text: "Book note: the city as an operating system you live inside." },
    { d: 9, text: "Cheap dopamine is a loan. Sleep is the repayment plan." },
    { d: 15, text: "You don't rise to your goals, you fall to your defaults." },
  ].map(({ d, text }) => ({ ...stamp(at(now, d, 22, 40)), text }));

  // ---------- body / journal / gigs ----------
  const bodyLogs = [
    { d: 14, weight: 186.0 }, { d: 7, weight: 185.2 }, { d: 0, weight: 184.6 },
  ].map(({ d, weight }) => ({ ...stamp(at(now, d, 7, 45)), weight, unit: "lbs" }));

  const journalLogs = [
    { d: 11, text: "Missed three stretch days after the double shift. Old me would have deleted the app. New me just… started again. That's the whole upgrade." },
    { d: 2, text: "Grounding ritual is actually working. Ten minutes offline and the static drops." },
  ].map(({ d, text }) => ({ ...stamp(at(now, d, 21, 50)), text }));

  const gigs = [
    { d: 6, text: "Refill meds before the weekend", doneD: 5 },
    { d: 12, text: "Book dentist — it's been a year", doneD: 8 },
    { d: 4, text: "Replace running shoes (soles are toast)" },
  ].map(({ d, text, doneD }) => {
    const ts = at(now, d, 10);
    return {
      id: uuid(), text, createdDay: keyOf(ts), ts,
      ...(doneD !== undefined
        ? { doneTs: at(now, doneD, 16), doneDay: keyOf(at(now, doneD, 16)) }
        : {}),
    };
  });

  // ---------- bio: one metric with an improving trend + one screening ----------
  const restingHr = { id: uuid(), name: "Resting HR", unit: "bpm", createdAt: at(now, 20, 9) };
  const bioReadings = [64, 63, 61, 62, 60].map((v, i) => ({
    ...stamp(at(now, 16 - i * 4, 8, 5)), metricId: restingHr.id, value: String(v),
  }));
  const phqAnswers = [1, 0, 1, 1, 0, 1, 0, 1, 0]; // mild, fictional
  const screenings = [{
    ...stamp(at(now, 10, 19)), tool: "phq9",
    score: phqAnswers.reduce((a, b) => a + b, 0), answers: phqAnswers,
  }];

  // ---------- goals ----------
  const goals = [
    { id: uuid(), name: "120 pages a week", icon: "📖", horizon: "week", target: 120,
      source: { kind: "readingPages" }, createdAt: at(now, 18, 9), order: 0 },
    { id: uuid(), name: "Train 3× a week", icon: "⚔", horizon: "week", target: 3,
      source: { kind: "workouts" }, createdAt: at(now, 18, 9), order: 1 },
  ];

  // ---------- kv: suppress first-run modals; settings are overrides only,
  // merged over DEFAULT_SETTINGS by the loader in src/db/repo.ts ----------
  const kv = [
    { key: "onboarded", value: true },
    { key: "lastBootDay", value: keyOf(now) },
    { key: "settings", value: { waterGoalMl: 2900, waterUnit: "oz", difficulty: "standard" } },
  ];

  return {
    app: "cyber-fit",
    schemaVersion: SEED_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    tables: {
      habits, habitLogs, waterLogs, moodLogs, workoutLogs,
      readingItems, readingLogs, highlightLogs, bodyLogs, journalLogs,
      gigs, bioMetrics: [restingHr], bioReadings, screenings, goals,
      tombstones: [], kv,
    },
  };
}

// CLI: `node scripts/seed-demo.mjs` refreshes the committed demo profile.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync("docs/guide/demo-profile.json", JSON.stringify(buildDemoExport(), null, 2) + "\n");
  console.log("wrote docs/guide/demo-profile.json");
}
```

While implementing, confirm the settings loader merges over `DEFAULT_SETTINGS`
(read `src/db/repo.ts` around lines 62–69). If it does **not** merge, change the
`settings` kv value to a full `{ ...DEFAULT_SETTINGS }` object copied from source.

### Step 1.3 — Verify and commit

1. `npx vitest run src/db/seed-demo.test.ts` → all green.
2. `npm test` → full suite still green.
3. `node scripts/seed-demo.mjs` → writes `docs/guide/demo-profile.json` (verify it
   parses and `.tables.habits` has 6 rows: `node --input-type=module -e "..."` or `jq`).
4. Commit: `git add scripts/seed-demo.mjs src/db/seed-demo.test.ts docs/guide/demo-profile.json`
   — message: `Add demo profile generator with schema-drift test`

---

## Task 2 — Screenshot driver + npm script

### Step 2.1 — Implement `scripts/shoot-demo.mjs`

```js
#!/usr/bin/env node
// Demo screenshot pipeline: serves the built app via vite preview, walks
// first-run onboarding, imports the generated demo profile through the real
// System → Import backup path, then captures docs/guide/img/*.png at 390×844.
// Run with `npm run shoot:demo` (builds dist first). Distinct from the
// marketing pipeline in shots/ — do not merge the two.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";
import { buildDemoExport } from "./seed-demo.mjs";

const OUT = "docs/guide/img";
const PORT = 4179; // shoot.mjs owns 4173, persist-check.mjs owns 4174

mkdirSync(OUT, { recursive: true });
const profilePath = join(tmpdir(), "cyber-fit-demo-profile.json");
writeFileSync(profilePath, JSON.stringify(buildDemoExport(), null, 2));

const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

let shot = 0;
const snap = async (name) => {
  await page.waitForTimeout(300); // let live queries and fonts settle
  shot += 1;
  const file = `${String(shot).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(file);
};
const nav = async (name) => {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name, exact: true })
    .click();
};

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

// Fresh browser context always sees first-run onboarding; click through it.
// (The starter habits it creates are wiped by the import below.)
await page.getByRole("button", { name: "Begin calibration" }).click();
await page.getByRole("button", { name: "Next", exact: true }).click();
await page.getByRole("button", { name: "Jack in" }).click();

// Import the demo profile through the app's real import path.
await nav("System");
await page.getByLabel("Import backup file").setInputFiles(profilePath);
await page.getByText("Backup restored").waitFor();

// Base shot of every screen.
await nav("Directives");
await snap("today");
await nav("Training");
await snap("training");
await nav("Bio");
await snap("bio");
await nav("Feed");
await snap("feed");
await nav("Goals");
await snap("goals");
await nav("Telemetry");
await snap("telemetry");
await nav("System");
await snap("system");

// Interaction states: nav drawer open, then the crash kit overlay.
// Reload between them — cheapest deterministic way to dismiss the drawer,
// and safe because all state lives in IndexedDB.
await nav("Directives");
await page.getByRole("button", { name: "Open menu" }).click();
await snap("menu");
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open crash kit" }).click();
await snap("crash-kit");

await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
console.log(`done — ${shot} screenshots in ${OUT}/`);
```

Notes for the implementer:

- `setInputFiles` works on the hidden file input — Playwright's actionability
  checks for it are attached/enabled only, not visible.
- If the crash kit button's accessible name differs at runtime, the source of
  truth is `src/ui/App.tsx:82` (`aria-label="Open crash kit"`).

### Step 2.2 — npm scripts

In `package.json` `"scripts"`, add:

```json
"seed:demo": "node scripts/seed-demo.mjs",
"shoot:demo": "npm run build && node scripts/shoot-demo.mjs"
```

### Step 2.3 — Verify and commit

1. `npm run shoot:demo` → exits 0, prints 9 filenames.
2. `ls docs/guide/img` → exactly `01-today.png … 09-crash-kit.png`, each > 20 KB.
3. **Eyeball** `01-today.png`, `06-telemetry.png`, and `09-crash-kit.png` (Read tool):
   Today shows the 6 directives with streak state and the water gauge partly filled;
   Telemetry shows charts with 3 weeks of data (not empty states); crash kit overlay
   is open. If any screen shows an empty state, the seed data for that table isn't
   rendering — fix the seed, not the screenshot.
4. Re-run `npm run shoot:demo` once more to confirm it's repeatable from a warm dist.
5. Commit: `git add scripts/shoot-demo.mjs package.json docs/guide/img`
   — message: `Add demo screenshot pipeline (npm run shoot:demo)`

---

## Out of scope

- Embedding the images into guide markdown (follow-up once guide prose exists).
- Desktop/tablet viewports, theming variants, day-one/empty-state shots.
- Any change to `shoots`/`shots/` marketing pipeline or `persist-check.mjs`.

## Risks

- **Schema drift:** covered — test pins `SEED_SCHEMA_VERSION === EXPORT_VERSION`.
- **Dexie import under node vitest:** Dexie construction without `open()` is safe;
  if it ever throws, move the `EXPORT_VERSION` assertion into a browser-driven check.
- **DST edges:** `keyOf` uses the per-timestamp `getTimezoneOffset()`, matching how
  the app computes keys locally.
