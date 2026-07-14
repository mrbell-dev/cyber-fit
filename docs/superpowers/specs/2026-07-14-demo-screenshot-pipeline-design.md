# Demo profile + screenshot pipeline — design

**Date:** 2026-07-14
**Status:** approved (sub-project 1 of 3; sub-project 2 = UX/clinician walkthrough + user guide, sub-project 3 = cyber-trainer CLAUDE.md/docs — each gets its own spec)

## Purpose

A repeatable pipeline that seeds a fictional demo user and screenshots every
screen of the app. The images feed the end-user guide (`docs/guide/`) and a
blog post; the seed doubles as a shareable "lived-in profile" export and a
light integration test of the import path. Re-runnable whenever the UI
changes so docs and blog images never go stale.

## Component 1 — seed module (`scripts/seed-demo.mjs`)

Data only, no browser code. Exports `buildDemoExport()` returning a cyber-fit
export JSON in the exact format `src/db/export.ts` produces, at the current
`schemaVersion` (read from source, never hardcoded).

Fictional user content, ~3 weeks of history generated backward from "now":

- 5–6 habits with realistic hit/miss/skip patterns — including at least one
  shield absorb and one reboot so forgiveness mechanics are visible in Stats
- water logs, mood logs with notes, a few workouts, one reading item,
  one or two body logs
- dayKeys computed via the engine's own `src/engine/` time logic
  (`dayStartHour` semantics), imported — never reimplemented
- habit names / notes are StreetSlang-appropriate but obviously fictional;
  nothing that could be mistaken for Michael's real data

The demo export JSON is committed to the repo so the exact demo state is
reproducible and shareable.

## Component 2 — screenshot driver (`scripts/shoot-demo.mjs`)

Follows the existing `shoot.mjs` / check-script patterns:

- build, `vite preview` on its own unique port
- Playwright, `getByRole`/`getByLabel` with `exact` (install-banner dodge)
- `prefers-reduced-motion` emulated so motion fx never blur a frame
- mobile viewport 390×844 only (phone-first PWA); no desktop pass

Flow: fresh browser context → complete onboarding minimally → import the
demo export through the real System → import UI (PlayerState rebuilt by the
engine fold — derived state is never hand-written) → walk each screen and
shoot: **Today, Feed, Stats, Training, Bio, Goals, System**, plus one
meaningful interaction state per screen where it earns it (e.g., log sheet
open on Today, a chart on Stats).

Deterministic filenames (`NN-screen-state.png`), overwritten in place so
re-runs diff cleanly. Wired up as `npm run shoot:demo`.

## Outputs

- Shots committed to `docs/guide/img/` (public repo; data is fictional),
  referenced by the future user guide with relative paths
- The demo export JSON committed (location — `scripts/demo-data/` or emitted
  by the seed module — decided in the implementation plan)
- Existing ad-hoc `shots/` directory is untouched

## Error handling / testing

- Import failure or a missing screen selector fails the script loudly
  (non-zero exit), same posture as the existing check scripts
- The seed module gets a small vitest check: export validates against the
  current schema shape and imports cleanly through the fold≡rebuild invariant

## Out of scope (later sub-projects)

- Day-one onboarding shots as archived assets (audit drives onboarding live
  in sub-project 2; adding shots later is a small script addition)
- Guide text, UX/clinician audit findings, PLAN.md tier candidates
- cyber-trainer CLAUDE.md and docs consolidation
- Blog posts themselves (two: cyber-fit UX; trainer architecture later)
