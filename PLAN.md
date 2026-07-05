# CYBER//FIT — Plan

Cyberpunk, ADHD-first self-improvement PWA. Live (playtest-gated) at
https://cyberfit.dev; push relay at relay.cyberfit.dev. Doctrine, judgment
rules, and workflow live in `CLAUDE.md` — this file is WHAT to build and WHY.

## STATUS

**Shipped (v0.9, July 2026):** PWA shell + Electric City theme · habits with
forgiving streaks (daily/weekdays/N-per-week/N-per-X rolling) · water · mood ·
highlight of the day · reading/learning + streaks · workouts (styles: sets/
AMRAP/EMOM/for-time/tabata, distance, offline exercise vocabulary) · bio-scan
weigh-ins with user cadence + weight trend chart · training volume chart ·
XP/levels/crits/shard-drops/shields · themes + fx augments · GitHub-style
uptime grid · #tags with intersection explorer · directive editor (Finch-style
card, areas, time-of-day, multi-pings) · directive library + suggestions ·
push relay (zero-PII, weekly slots, motivation lines, /test) · daily boot
greeting · data vault export/import · playtest gate. 63 engine tests green;
push verified on Michael's iPhone.

---

## TIER LIST v3 — playtest feedback pass (Michael's full walkthrough, 2026-07-04)
(v1 AND v2 tiers fully shipped July 2026 — Crash Kit, copy audit, anchors,
breathing overlay, PHQ-9/GAD-7 screeners, exercise DB, focus timer, hydration
defaults; see STATUS and git history. This list folds Michael's raw TODO from
using the live app. Ranking principle: bugs that break trust in the data
outrank broken flows, which outrank ergonomics, which outrank new features.)

### TIER S — trust-breaking bugs (fix before ANY feature work)

- [~] **LVL reset to zero after an update, with completed tasks intact.**
      NO DATA LOSS: `refreshPlayer()` folds all 11 log tables (verified — every
      v6/v7 table is in the bundle), and habit "done" state is derived from
      habitLogs independently of XP, which is why tasks stayed done while LVL
      read 0. Fable shipped a defensive fix (commit 0574999): a non-finite XP
      total or habit `charge` now degrades to level 0-safe numbers instead of
      NaN-poisoning the whole `xp` sum (NaN made `levelFromXp`'s while-loop exit
      at level 0). HARDENED but ROOT CAUSE UNCONFIRMED — there is no UI path
      that produces a NaN charge (chips only emit 1–5), so the actual NaN
      ingress (corrupt/hand-edited import? an older code path?) was never
      reproduced. STILL OWED: Michael's real export to confirm, per the
      original note. If his export folds to a correct level now, close it.
- [x] **Highlight of the day OVERWRITES instead of keeping a running log.**
      DONE (2b75300). Data was never lost — highlightLogs is append-only; the
      CARD only *displayed* the newest row. Now lists all of today's; the
      28-day reel already showed history.
- [x] **Data Vault: "relay unreachable" on desktop Chrome.** DONE (dc75b3b).
      Root cause: single-value CORS `Access-Control-Allow-Origin` matched only
      the apex origin, so requests from `www.cyberfit.dev` were browser-blocked.
      Relay now echoes an allowlisted Origin (apex + www) with `Vary: Origin`;
      verified live for both, and a foreign origin gets the apex fallback.
- [x] **iOS global: page zooms on input focus and STAYS zoomed.** DONE
      (2b75300). All form controls now ≥16px (`.input`, `.time-input`); no
      `maximum-scale` hack, so pinch-zoom still works.

### TIER A — broken flows

- [~] **Reading/learning log-session dialog:** feeling labels DONE (2b75300 +
      1676538 — the feeling row got its own line so labels render). OPEN: "the
      session TYPE comes up wrong when you click log" is ambiguous from the
      code (SessionForm has no type field; type lives on the ReadingItem) —
      NOT guess-patched. Needs a screenshot from Michael of what reads wrong.
- [x] **Physical training form dynamic per workout style.** Already satisfied:
      `WorkoutCard` gates score/sets/duration/distance on `styleDef.fields.*`
      (sets-only for "Sets×reps", duration+distance for cardio, etc.). Michael
      likely saw a pre-styles build. No code change; verify visually once.
- [x] **Directive editor bugs.** DONE (1676538): emoji "…" was hardcoded to
      open — now toggles closed (and closes on pick); the anchor input was a
      bare `<input>` (~170px) so it "stopped halfway across" — now full-width.
- [x] **Vitals: reading shows the mood NAME with its note; note spans the
      card.** DONE (1676538) — verified live (shot: vitals-name-note.png).
- [ ] **Shields are a mystery in Telemetry.** Nobody can tell what they are
      or how to earn them from the UI. Add a one-tap explainer on the stat
      (earned +1 per 5 active days, cap 3, auto-absorb a miss) linking the
      Field Manual entry.
- [ ] **Visual Cortex unlocks are invisible.** Michael can't tell what the
      fx/themes look like or whether they exist. Add mini-previews (a swatch
      strip / 1-line fx demo) and VERIFY each unlock actually applies.

### TIER B — the ⓘ restructure (the Stats verdict)

Michael asked for an honest read: he's right, not obtuse. Stats-as-destination
is a failed pattern here — nobody commutes to a stats tab; charts belong where
the data lives. Direction:

- [ ] **Every measurable card (Log/Today) gets an ⓘ top-right** opening that
      thing's history + chart in a popup: weight trend (WITH numbers on the
      data points) moves to bio-scan's ⓘ · hydration chart to hydration's ⓘ ·
      reading/learning ⓘ = the full library, filterable by type (find the
      book/video you want to recommend to a friend) · journal entries always
      openable to review/edit.
- [ ] **Highlight Reel: show last 10, truncate, "view all" → filterable
      full-history view.** (Pairs with the running-log fix in Tier S.)
- [ ] **Stats slims down to an overview:** uptime grid, level/streak
      telemetry, screener trends, exports. Telemetry goes DYNAMIC — only
      sources the user actually tracks appear (someone who can't work out
      must never stare at a permanent zero. Forgiveness applies to layout
      too).
- [ ] **Drop the Tag Explorer screen.** Agreed and recorded: the screen isn't
      earning its tab. KEEP #tag parsing in free text (zero-cost, feeds
      export and any future search); delete only the explorer UI.
- [ ] **Journal polish:** spacing between entries; long entries truncate with
      … and open in a review/edit popup.

### TIER C — editor ergonomics & bio-scan generalization

- [ ] **Directive editor controls:** schedule and area become dropdowns;
      anchor becomes a dropdown of the user's OWN active directives (free
      text stays as fallback); charge (⚡) becomes a 1–5 slider.
- [ ] **Global quiet hours + master notification switch.** When notifications
      are globally off, editors never even SHOW ping options (don't prompt
      for what can't fire). Quiet hours clamp all ping times, push and
      in-app.
- [ ] **Bio-scan generalization — metric library with a + (mirror the
      directive codex):** weigh-in stops being the hardwired default; presets
      to pick from (weight, blood pressure, glucose, resting HR, …) plus
      fully custom; per-metric settings (cadence, pings on/off) saved at add
      time and editable after; per-metric chart via the ⓘ; UNDO the last
      reading (mistypes happen); the separate "custom biometrics" section
      then folds away. Doctor-driven use case: "BP twice a day for my doc."
- [ ] **Reading/learning one-shots:** a "this was a one-time thing" checkbox
      → log the feeling, save, done — it never lingers in the feed waiting
      for "finish".
- [ ] **Codex growth:** a handful more general health/wellbeing presets;
      optional suggestions popup reachable from the add-directive page.
- [ ] **Notification inventory view:** one list of every ping that can fire —
      user-defined (per-directive, per-metric) and system (morning boot,
      motivation) — classified as such, each toggleable from the list.

### TIER LT — flavor, reach, and the long game (carried forward)

- [ ] **Accessibility audit:** full axe pass + a real VoiceOver/TalkBack
      walkthrough (carried from v2 — needs a human session, still owed).
- [ ] **Cyberware rig:** SVG avatar gaining visible chrome per level (arm LVL 3,
      optic LVL 6, spine LVL 10…). Cosmetic only. Art is the bottleneck —
      build the slot system first, invite community art PRs.
- [ ] **Google Play native (Capacitor):** $25 one-time, real local
      notifications (no relay), true background sync, haptics guaranteed.
      First store target per the pricing research; iOS only if ~120 sales/yr
      materialize (Apple waiver is free-apps-only — verified).
- [ ] **Cyber-trainer SMS (Michael-only, separate private repo):** Twilio +
      local Ollama; text the bot ("just finished the workout") → it infers
      the Tuesday routine, logs it, and — holding Michael's vault cypher key
      privately — pulls, modifies, re-uploads the encrypted vault. Never in
      the OSS app. Full design drafted 2026-07-04 (local only, off-repo:
      `~/Desktop/cyber-trainer/DESIGN.md`). One piece DOES belong in the OSS
      app when its turn comes: an additive **merge-import** (union by row id
      through repo.ts) — generally useful, and the trainer's safe write path.
- [ ] **Localization scoping** (string extraction cost; the voice is hard to
      translate — scope before promising).
- [ ] Watch: Declarative Web Push / Safari releases (each may shrink the
      native-port motivation).

### Decisions recorded this pass (don't relitigate)

- **BYO push relay stays OPTIONAL, not the default.** Michael proposed making
  users provide their own relay by default. Pushback given and holding:
  requiring a Cloudflare deploy before the first ping means ~nobody gets
  pings, and the central relay is already zero-PII/completion-blind (pillar 1
  is satisfied; pillar 4 — ADHD-simple default path — decides). Ship instead:
  make the self-host option loud in Reminder Uplink (custom relay URL + VAPID
  field already exist; add the SELF-HOSTING.md link right there).
- **Tag Explorer screen dropped; #tag parsing kept** (rationale above).
- **Stats becomes overview-only; per-thing charts live on the things** (the ⓘ
  pattern above).

### Post-eval candidates (Claude's picks, 2026-07-04 — NOT committed; revisit
after Michael's 30-day daily-driver eval, and only after Tiers S–C are done)

- **Quick-log command line.** One always-visible input on Today: type
  "water 500", "pushups", "mood 4 rough day" → parsed LOCALLY (no AI, a small
  grammar over the user's own directives/metrics) → logged in one action.
  The single biggest remaining tap-reduction available; the keyboard-native
  cousin of the SMS trainer. Highest-conviction pick on this list.
- **Done-stack collapse on Today.** Completed directives celebrate, then
  collapse into a one-line "✓ n synced" stack at the bottom. As the directive
  count grows, the ADHD failure mode is a wall where done and not-done look
  the same weight. Show what's LEFT; tuck what's finished.
- **Weekly System Report** (in the original design, never shipped — verified
  absent). Sunday recap card, positively framed, fully on-device: what ran,
  what leveled, best day. Doctrine: totals and highlights only — never
  misses, never week-over-week decline framing.
- **Honest on-device insights.** After ~6 weeks of data: "on days water hit
  goal, mood averaged +0.8 (23 days of data)". Correlation stated as
  correlation, n always shown, no claim below n=14. This is the "real
  progress data takes over from gamification" pillar becoming a feature.
  Needs real data volume first — that's why it waits for post-eval.
- **Backup-age status line.** Local-first's one real danger is device loss.
  A quiet line in Data Vault + a monthly system ping: "last backup: 34 days
  ago." System status framing, never guilt framing.
- **Time-aware Today ordering.** Morning directives float up in the morning,
  evening + journal after dark. Pure reorder of existing timeOfDay data —
  cheap, and cuts scanning load exactly when executive function is thinnest.
- **PWA manifest `shortcuts`** (long-press app icon → "Log water" / "Crash
  Kit" jump links via the existing ?go= deep-link routing). Android-only in
  practice; near-zero cost.
- **Considered and NOT recommended:** voice input (Web Speech API ships audio
  to Google on Chrome — pillar 1 violation; the command line covers the
  need) · in-app AI coach (server inference violates pillars; local models
  can't ship in a PWA; cyber-trainer covers it personally) · calendar
  integration (OAuth gravity, same verdict as Drive).

**Explicitly cut from the queue (recorded so it stays cut):** acts-of-kindness
suggestions (nice, but suggestion fatigue is real and the gig list already
holds intentions) · friends/social (identity vs zero-PII — parked until an
E2E share-code design exists) · mood quizzes beyond PHQ-9/GAD-7 (screeners
yes, quiz-toy content no).

---

## Design reference (stable — implemented; change only with intent)

### Pillars
Off-grid by design (100% offline-functional; notifications nice-to-have) ·
zero PII (only opt-in push subscription + slot numbers leave the device; TLS;
E2E-encrypted payloads) · forgiving by default (skip ≠ fail; shields absorb;
"reboot" never "failure"; no missed counts) · 1–2-tap logging · cosmetic-only
rewards, usability never limited.

### Data model
Append-only Dexie event logs (habits, habitLogs, waterLogs, moodLogs,
workoutLogs, readingItems, readingLogs, highlightLogs, bodyLogs, kv) →
`PlayerState` derived by a full deterministic fold (`engine/rebuild.ts`) after
every write. dayKey computed at log time (dayStartHour, default 3 AM). Export
= all tables as JSON; import validates then rebuilds.

### Gamification
Base XP per source with daily caps; crits (~15%, 2×) and shard drops (~4%)
seeded on event ids (deterministic, no re-rolls); level curve
`xpToNext = 100 + 50·level` styled as FIRMWARE; shields: +1 per 5-day global
streak, cap 3, auto-spend on misses; weigh-in XP spaced to the user's chosen
cadence (~70%) — never reward checking faster than the user's own rhythm.

### Push relay
Cloudflare Worker + KV; stores {anonymous subscription, weekly 15-min UTC
slots, motivationSlots}. Cron */15 dispatch; motivation slots get a random
line from the public pool in worker code; everything else "Time to sync."
(themed copy lives client-side). Endpoints: /subscribe /unsubscribe /health
/test. Self-hosting documented in SELF-HOSTING.md (Cloudflare or home Node
box — outbound-only HTTPS, no open ports).

### Theme & voice
Electric City default (#1B1B2A / #FF007A / #00FFB3 / #A700FF / #FFEA00);
magenta/purple accent-only (sub-AA as body text); themes = CSS custom-property
packs, one PR to add; alt palettes are augment unlocks. Fonts: Chakra Petch +
IBM Plex (OFL, self-hosted). Voice lexicon: StreetSlang.md, applied sparingly.

## Research anchors (why it's built this way)
ADHD habit automation ≈ 106–154 days → design for the long haul, forgive
everything; streak freezes cut at-risk churn ~21% (Duolingo); variable rewards
beat fixed; light/medium gamification retains, heavy grinds die; gamification
scaffolds initiation then real data motivates. Web push: no local scheduling
API exists in PWAs; iOS needs A2HS + 16.4+. Key sources: habit-streak.com ADHD
guide · cohorty.app gamification research · magicbell.com iOS PWA limits ·
Cloudflare Workers/KV docs · github.com/draphy/pushforge.
