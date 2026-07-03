# CYBER//FIT — project guide

Cyberpunk-themed, ADHD-first self-improvement PWA. Live at **https://cyberfit.dev**
(playtest-gated), push relay at **https://relay.cyberfit.dev**. Everything is a
Cloudflare Worker: the app is static assets behind `gate/index.mjs`, the relay is
`worker/`. GitHub Actions is CI-only; deploys are `npm run deploy` (app) and
`npm run deploy:relay`. Repo: github.com/mrbell-dev/cyber-fit (MIT).

**The work queue is the TIER LIST in `PLAN.md`** (S → A → B → C → LT), with
the stable design reference below it. When Michael sends raw feedback, fold it
into the tier list thoughtfully — that file is the single source of "what's next."

## Product north star

Finch, but cyberpunk, with more depth for power users — and none of Finch's
cutesiness or account requirement. Gamification scaffolds habit initiation;
real progress data takes over. The user we design for has ADHD: fast feedback,
1–2-tap logging, forgiving mechanics, zero guilt.

## The rules that matter (non-negotiable)

1. **The engine is pure.** `src/engine/` has zero DOM/React/IO and no
   `Date.now()`/`Math.random()` — clock/tz/RNG injected. Everything imports from
   `src/engine/index.ts` only. Reward rolls are seeded on event ids (no re-rolls).
2. **Event logs are the source of truth.** Append-only Dexie tables; `PlayerState`
   is derived by `engine/rebuild.ts` (a full deterministic fold, re-run after every
   write — snapshot can never drift). `src/db/repo.ts` is the ONLY writer.
3. **dayKey is computed at log time** (`engine/time.ts`, `dayStartHour` default 3AM).
   Never do date math on raw timestamps; never recompute a day later.
4. **Offline is need-to-have; notifications are nice-to-have.** No feature may
   gate on push, network, or permissions — and no nagging about them.
5. **Zero PII, ever.** The relay stores ONLY {anonymous push subscription, slot
   numbers}. It is schedule-blind and completion-blind — "remind until done" can
   only quiet IN-APP nudges; push payloads stay generic. Don't add dependencies
   that phone home. TLS everywhere (enforced by .dev + Workers).
6. **Forgiving by default.** Skip ≠ fail. Shields auto-absorb misses. Resets are
   "reboots", never "failure". NEVER surface a count of missed
   notifications/days — a returning user gets a warm welcome-back ("Good to see
   you, choom. Ready for a new gig?"), not a pile of guilt. This is doctrine.
7. **Cosmetic-only rewards.** Augments/cyberware unlock looks and flavor, never
   functionality. Never limit usability behind progression or payment.
8. **Accessibility over flavor.** Magenta/purple are accent-only (fail AA as body
   text on navy). Motion fx double-gated (prefers-reduced-motion AND a toggle).
   48px tap targets. Every input labeled.
9. **Dexie discipline:** never edit a shipped `db.version(n)` — append n+1.
   Export/import (`src/db/export.ts`) must cover every new table; PlayerState is
   always rebuilt from logs on import, never trusted from the file.

## Voice & copy

Cyberpunk flavor, clarity first. `StreetSlang.md` (repo root) is the reference
lexicon — draw from it, don't cosplay it; one slang term per message beats five.
Established voice: directives, "Rise and shine, Night City.", "shield absorbed
the hit", LVL as FIRMWARE, bio-scan, data shards, OFF-GRID/LINKED chips, "jack
in". Tone toward the user: competent adult, warm, never saccharine, never
scolding. The grounding lore: *stay grounded, avoid cyberpsychosis*.

## Layout

```
src/engine/   pure core: time, habits (schedules incl. nPerX rolling windows),
              streaks, water, xp/rewards (crits, shard drops, daily caps),
              rebuild, reminders (slot math), tags, presets, exercises
src/db/       db.ts (Dexie v5) · repo.ts (single write path) · export.ts
src/ui/       React: screens (Today/Log/Stats/System), components, theme/
              (tokens.css = Electric City + alt palettes; themes are CSS packs)
gate/         TEMPORARY playtest password gate (delete + 2 wrangler.toml lines at launch)
worker/       push relay: KV, @pushforge/builder, cron */15, week-minute slots,
              /subscribe /unsubscribe /test, motivation line pool
scripts/      icons.mjs + Playwright checks: offline, persist, vault round-trip
```

## Workflow

- `npm test` — 63 vitest tests incl. fast-check property tests. Add tests for
  every engine change; the fold≡rebuild determinism is the core invariant.
- `npm run build` — strict tsc + vite (noUnusedLocals on).
- **Verify visually:** drive the real app with Playwright (see `scripts/*.mjs`
  patterns — use `getByRole`/`getByLabel` with `exact` to dodge the install
  banner), screenshot, and SEND screenshots to Michael (he's usually on mobile).
- `npm run check:offline` / `check:persist` / `check:vault` before shipping.
- Worker: `cd worker && node test.mjs` (pure logic, mock KV).
- Deploy: `npm run deploy` / `npm run deploy:relay` (wrangler is authed on this
  machine). Secrets live in Cloudflare: GATE_PASSWORD, GATE_KEY (app worker),
  VAPID_PRIVATE_JWK (relay). VAPID public key is baked in `.env.production`.
- Commit per feature with a descriptive message; push to main (deploys nothing —
  CI tests only).

## How to work on this project (the loop that built it)

1. Read the `PLAN.md` TIER LIST and pick the next unchecked item (Tier S first).
2. Engine change → colocated vitest test IN THE SAME COMMIT. UI change → drive
   it with a throwaway Playwright script (copy a `scripts/demo-*.mjs` pattern,
   unique preview port, then delete the script), screenshot, and **send the
   screenshot to Michael** — he reviews visually, usually on a phone.
3. `npm test && npm run build` green → commit (one feature per commit,
   descriptive message) → `git push` → `npm run deploy` (and `deploy:relay` if
   `worker/` changed).
4. Michael wants pushback, not agreement: if a request conflicts with the rules
   above, say so plainly and offer the pillar-compatible version (that's how
   accounts-first became encrypted vault sync). Precision over politeness;
   never claim something shipped without having verified it end-to-end.

## Judgment layer — how to decide when the rules don't decide for you

### Precedence when principles collide (higher wins)

1. **Privacy / zero-PII** — beats every feature, every convenience.
2. **Offline usability** — a feature that only works online isn't a feature yet.
3. **Forgiveness** — beats accuracy ("you missed 5 days" may be true; we still
   never say it). Beats engagement metrics too.
4. **ADHD-simplicity of the DEFAULT path** — the first-run experience is 1–2
   taps, zero required config. Depth is welcome **behind** progressive
   disclosure (Michael wants power-user detail — as opt-in, never as friction).
5. **Honesty of the system** — real limits stated in-UI beats magic that lies.
6. **Cyberpunk flavor** — seasoning, applied last, never at the cost of 1–5.

### The translate-don't-refuse pattern (use it constantly)

When a request conflicts with a pillar, the job is to find the need under the
request and ship the pillar-compatible version of it. Real calibration cases:
- "Online accounts first" → need was cross-device → **encrypted vault sync**.
- "Google Drive sync" → need was backup-everywhere → **File System Access
  against any synced folder**.
- "Remind until complete" → relay must stay completion-blind → **in-app nudges
  quiet when done; push stays generic**.
- "Emoji keyboard on focus" → impossible on web → **in-app emoji picker**.
Name the conflict in one sentence, give the alternative, build it. Refusing
without an alternative and silently complying are both failures.

### When to build vs. when to assess

- Michael states a problem or "I might want…" → give the honest assessment
  first (he rejects ideas when shown real costs — accounts-first died in one
  message). Don't build speculatively.
- Michael asks for a feature → build it, and fold every queued follow-up into
  the same pass. Record anything deferred in PLAN.md WITH the reasoning, so
  decisions stick and don't get relitigated.
- Genuinely ambiguous scope → ship the smallest verifiable slice, screenshot,
  let the screenshot ask the question.

### Definition of done — any new tracker/metric (checklist, all required)

☐ 1–2-tap fast path (detail optional) ☐ forgiving streak semantics
☐ XP source with a daily cap, rewarding the USER'S chosen cadence (never
faster — see bio-scan spacing) ☐ chart or calendar if chartable ☐ covered by
export/import + rebuild ☐ #tags work in its free text ☐ reminder option baked
into the object, OFF by default ☐ engine tests incl. the fold≡rebuild property
☐ fully usable offline and with push denied

### Copy test (run on every user-facing string)

Would this string feel kind at 11pm to someone who's had a bad week? Does it
name the mechanic positively (shield/reboot/rest — never lost/failed/behind)?
Is it clear with zero slang knowledge? Then at most one StreetSlang term.

### Things to push FOR proactively (don't wait to be asked)

Accessibility on every new control; a screenshot with every UI change; caps on
every new XP source; recording rejected ideas in PLAN.md; flagging when a
feature would be the app's first violation of a pillar (that's a red line, say
so even mid-implementation); simplifying anything that grew a second config
knob before its first real user.

## Settled decisions — don't reopen, don't re-promise

- **No online accounts** (rejected 2026-07-03: privacy, liability, migration
  gravity). Cross-device = encrypted vault sync (design in PLAN.md).
- **No third-party fitness APIs** (Strava/Garmin/Apple Health need OAuth +
  servers; Apple Health has no web API). Bundled open exercise list instead.
- **No Google Drive API** (OAuth contradicts off-grid) — File System Access
  API against any synced folder instead.
- **OS emoji keyboard can't be forced on the web** — that's why the in-app
  emoji picker exists.
- **Push relay is completion-blind and schedule-blind by design** — "remind
  until done" quiets in-app nudges only; don't "fix" this by sending state.

## Platform physics (hard limits — design around, never against)

- Relay slots are a WEEKLY 15-min UTC grid (day×1440+min, [0,10080)). Monthly/
  yearly reminders therefore cannot push — in-app nudges cover those cadences.
- iOS: no `navigator.vibrate` (haptics are Android-only), no PWA background
  sync, push only for the installed A2HS app on 16.4+.
- Secrets NEVER enter this (public) repo: GATE_PASSWORD/GATE_KEY/
  VAPID_PRIVATE_JWK live as Cloudflare secrets (`npx wrangler secret put`,
  run in the right directory). Rotating the gate code is one command; the
  VAPID public key in `.env.production` is public by design.

## Known sharp edges

- iOS push requires the installed (A2HS) app, 16.4+, user-gesture permission;
  subscriptions can drop — `syncPush()` re-uploads on every open. Never load-bearing.
- The gate means every request invokes the worker (fine for beta; remove at launch).
- Shell tool on this box is zsh-flavored — write multi-step verification as bash
  script files, not inline one-liners.
- `addHabit` takes an explicit input shape — when adding Habit fields, update it
  AND the editor save path AND export (this bit us once; see git log).
