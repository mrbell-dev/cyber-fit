# cyber-fit — project guide for Claude

A mobile-first cyberpunk self-improvement PWA: habits, water, workouts, reading, mood —
with ADHD-first UX and light gamification. 100% client-side data (IndexedDB via Dexie);
the only networked component is an optional, opt-in push-reminder Cloudflare Worker.
See `PLAN.md` for the roadmap + current STATUS.

## The rules that matter

1. **The engine is pure and must stay that way.** `src/engine/` has zero DOM/React/IO and
   no `Date.now()` / `Math.random()` — clock, timezone, and RNG are injected via a `Ctx`.
   The UI never computes domain logic; it calls engine functions and renders the result.
   Everything imports from `src/engine/index.ts` only.
2. **Event logs are the source of truth.** Append-only Dexie tables; `PlayerState` is a
   derived snapshot maintained by the pure reducer and fully rebuildable via
   `engine/rebuild.ts`. `src/db/repo.ts` is the ONLY writer (append log → apply → save
   snapshot, one transaction).
3. **dayKey is computed at log time** (`engine/time.ts`, honoring `dayStartHour`, default
   3 AM). Never recompute a day from a timestamp later; never do streak math on
   timestamps.
4. **Offline is need-to-have; notifications are nice-to-have.** No feature may gate on
   push, network, or permissions. No nagging about them either.
5. **Zero PII, ever.** Nothing leaves the device except the opt-in push subscription +
   slot numbers to the worker. No analytics or telemetry of any kind. Don't add
   dependencies that phone home.
6. **ADHD-first copy and mechanics.** Forgiving streaks (shields auto-absorb misses,
   resets are "reboots", never "failure"), 1–2-tap logging, skip ≠ fail. Keep the
   cyberpunk voice, but clarity beats flavor.
7. **Accessibility:** magenta `#FF007A` / purple `#A700FF` are accent-only (glows,
   borders, large display type) — never body text on navy. Motion effects double-gated
   behind `prefers-reduced-motion` AND a settings toggle.

## Layout

```
src/engine/   pure core: time, habits, streaks, water, xp, rewards, apply, rebuild
src/db/       Dexie schema + repo (single write path) + export/import
src/ui/       React: App/Nav/screens (Today, Log, Stats, System), theme/tokens.css
worker/       optional push worker (Cloudflare, KV, pushforge)  [Phase 4]
scripts/      icons.mjs (SVG→PNG via Playwright), shoot/offline/persist checks
```

## Workflow

- **Test:** `npm test` (Vitest; colocated `*.test.ts`, property tests with fast-check —
  key invariant: folding `apply` over logs ≡ `rebuild`).
- **Build:** `npm run build` (tsc strict + Vite; `noUnusedLocals` on).
- **Icons:** `npm run icons` after editing `src/assets/icon.svg`.
- **Verify visually:** `npm run shots` → screenshots in `./shots`; send them to the user
  (often on mobile). `npm run check:offline` / `check:persist` for PWA behavior.
- Dexie migrations: never edit a shipped `version(n)` — append `version(n+1)`.
