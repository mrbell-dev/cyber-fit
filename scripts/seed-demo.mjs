#!/usr/bin/env node
// Demo profile generator — builds a fictional 3-week profile as a cyber-fit
// backup file (the same JSON shape the app's own Export produces). Consumed by
// scripts/shoot-demo.mjs and emitted to docs/guide/demo-profile.json for
// manual "try the demo" imports.
//
// All data is fictional. No real people, no real health data.
// Requires node ≥ 23 (native TS type-stripping for the engine import below).
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dayKeyFor } from "../src/engine/time.ts";

// Must match EXPORT_VERSION in src/db/export.ts — drift is caught by
// src/db/seed-demo.test.ts, which imports both and asserts equality.
export const SEED_SCHEMA_VERSION = 10;

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

  // ---------- goals (incl. a manual + lifelong open-ended one) ----------
  const coldPlunge = { id: uuid(), name: "Cold plunges", icon: "🧊", horizon: "lifelong",
    source: { kind: "manual" }, createdAt: at(now, 20, 9), order: 2 };
  const goals = [
    { id: uuid(), name: "120 pages a week", icon: "📖", horizon: "week", target: 120,
      source: { kind: "readingPages" }, createdAt: at(now, 18, 9), order: 0 },
    { id: uuid(), name: "Train 3× a week", icon: "⚔", horizon: "week", target: 3,
      source: { kind: "workouts" }, createdAt: at(now, 18, 9), order: 1 },
    coldPlunge, // no target = open-ended running count
  ];
  const goalLogs = [17, 14, 9, 5, 2, 0].map((d) => ({
    ...stamp(at(now, d, 7, 15)), goalId: coldPlunge.id, amount: 1,
  }));

  // ---------- kv: suppress first-run modals; settings are overrides only,
  // merged over DEFAULT_SETTINGS by getSettings() in src/db/repo.ts ----------
  const kv = [
    { key: "onboarded", value: true },
    { key: "lastBootDay", value: keyOf(now) },
    { key: "gigMigratedDay", value: keyOf(now) }, // suppress carry-over-gigs modal

    { key: "settings", value: { waterGoalMl: 2900, waterUnit: "oz", difficulty: "standard" } },
  ];

  return {
    app: "cyber-fit",
    schemaVersion: SEED_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    tables: {
      habits, habitLogs, waterLogs, moodLogs, workoutLogs,
      readingItems, readingLogs, highlightLogs, bodyLogs, journalLogs,
      gigs, bioMetrics: [restingHr], bioReadings, screenings, goals, goalLogs,
      tombstones: [], kv,
    },
  };
}

// CLI: `node scripts/seed-demo.mjs` refreshes the committed demo profile.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync("docs/guide", { recursive: true });
  writeFileSync("docs/guide/demo-profile.json", JSON.stringify(buildDemoExport(), null, 2) + "\n");
  console.log("wrote docs/guide/demo-profile.json");
}
