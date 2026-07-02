# Contributing to cyber-fit

Contributions welcome — themes, translations, bug fixes, new tracker ideas.

## Ground rules (the design pillars — PRs that break these won't merge)

1. **Off-grid by design.** Every feature must work for a permanently offline
   user. No feature may gate on push, network, or permissions.
2. **Zero PII.** Nothing leaves the device except the opt-in push subscription +
   slot numbers. No analytics, no telemetry, no dependencies that phone home.
3. **Forgiving by default.** Skip ≠ fail. No mechanic may punish a missed day
   harder than "streak reboots to 0 after shields run out". Copy says "reboot",
   never "failure".
4. **1–2 taps to log.** If a flow takes more taps, it needs a fast path.
5. **Cosmetic-only rewards.** Augments unlock looks, never functionality.
6. **Accessible flavor.** Motion fx double-gated (prefers-reduced-motion AND a
   toggle). Body text stays AA-contrast; neon magenta/purple are accent-only.

## Architecture in 30 seconds

- `src/engine/` — pure logic, no DOM/IO/`Date.now()`/`Math.random()`. Everything
  imports from `src/engine/index.ts`. Event logs are the source of truth;
  `rebuild.ts` derives PlayerState deterministically.
- `src/db/` — Dexie. `repo.ts` is the only writer. Never edit a shipped
  `db.version(n)` — append `version(n+1)`.
- `src/ui/` — React. Renders state, dispatches through repo.
- `worker/` — optional push relay (Cloudflare Worker or Node).

See `CLAUDE.md` for the full conventions and `PLAN.md` for the roadmap.

## Adding a theme (most-wanted contribution!)

1. Add a CSS block in `src/ui/theme/tokens.css`: `html.theme-yourname { …custom
   properties… }` (copy an existing block).
2. Register it in `src/ui/theme/themes.ts` (set `augment: null` for free, or add
   an augment in `src/engine/rewards.ts` to make it an unlock).
3. Check contrast: body text ≥ AA on your background.

Medieval pack? Synthwave? Terminal-green? Yes.

## Dev loop

```bash
npm install && npm run icons
npm run dev        # local server
npm test           # engine tests (vitest + fast-check)
npm run build      # strict tsc + vite build
npm run shots      # screenshots to ./shots
npm run check:offline && npm run check:persist && npm run check:vault
```

For the relay: `cd worker && npm test` (pure logic tests, no network).
