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

- [x] **Reading/learning log-session dialog.** Feeling labels DONE (2b75300 +
      1676538). "Type wrong" CLARIFIED + DONE: finishing/logging a VIDEO earned
      XP the toast labelled "reading". The `reading` XP source covers the whole
      feed (book/article/video/audiobook/class); the toast now labels it
      "learning" (honest umbrella) instead of "reading". Verified live: a video
      session toasts "+15 XP — learning". NOTE for Tier B: Stats.tsx still
      calls the aggregate "Reading" — fold into the stats restructure.
- [x] **Physical training form dynamic per workout style.** Already satisfied:
      `WorkoutCard` gates score/sets/duration/distance on `styleDef.fields.*`
      (sets-only for "Sets×reps", duration+distance for cardio, etc.). Michael
      likely saw a pre-styles build. No code change; verify visually once.
- [x] **Directive editor bugs.** DONE (1676538): emoji "…" was hardcoded to
      open — now toggles closed (and closes on pick); the anchor input was a
      bare `<input>` (~170px) so it "stopped halfway across" — now full-width.
- [x] **Vitals: reading shows the mood NAME with its note; note spans the
      card.** DONE (1676538) — verified live (shot: vitals-name-note.png).
- [x] **Shields explainer — made DISCOVERABLE.** DONE (this pass). Root cause
      wasn't a missing explainer: a tappable "Shields ⓘ" tile + inline text +
      a full Field Manual "Shields ▣" entry all already existed (0716b43,
      before the walkthrough). But `.stat-tile.tappable` only set
      `cursor:pointer` — invisible on a touchscreen, so all 8 tiles looked
      identical and the tap was never found. Fix: the shields tile now has a
      green dashed border + green ⓘ (solid + glow when open), `aria-expanded`,
      and the explainer names the earn rule (+1 per 5 active days, cap 3,
      auto-absorb) and points to the Field Manual. Verified live (screenshot:
      shields-explainer.png). **TIER A COMPLETE** except backlogged LVL.
- [x] **Visual Cortex unlocks now preview.** DONE (this pass): theme tiles
      render the real 5-colour palette swatch strip (kept in sync with the
      html.theme-* packs); FX tiles show a scoped live mini-demo (scanline
      texture / glitching "CYBER//FIT" / CRT "SIGNAL"). Locked packs still
      preview (dimmed) so you see what you'd unlock; the catalog lists the
      unlock condition. Apply path (saveSettings → applyTheme/applyFx) is the
      existing verified one — Electric City stays active on select
      (screenshot: visual-cortex.png). NOTE: could not screenshot a LOCKED
      theme actually applying without granting it; the apply mechanism is
      unchanged from v0.9, only the preview is new.

### TIER B — the ⓘ restructure (the Stats verdict) — COMPLETE 2026-07-05

Michael asked for an honest read: he's right, not obtuse. Stats-as-destination
is a failed pattern here — nobody commutes to a stats tab; charts belong where
the data lives. Shipped in 3 chunks via a reusable `InfoSheet`/`InfoButton`
(ⓘ in a card-header opens a detail sheet).

- [x] **Every measurable card gets an ⓘ.** DONE. Bio-Scan ⓘ → weight trend
      with a NUMBER ON EVERY POINT + full scan history w/ deltas · Hydration ⓘ
      → 14-day intake vs goal · Physical Training ⓘ → training volume (8 wk) ·
      Reading/Learning ⓘ → full library filterable by type (find the
      book/movie to recommend) · Journal entries tap → review/edit/delete sheet.
- [x] **Highlight Reel: last 10 + "view all (N)" → searchable archive.** DONE.
- [x] **Stats slimmed to an overview:** charts moved to their cards; what
      remains = telemetry tiles, weekly System Report, uptime grid, Trauma
      Team export, highlight reel. Telemetry was ALREADY dynamic (workout/
      reading/learning tiles hide when untracked; core level/XP/streak/shield
      stay). Nobody stares at a permanent zero.
- [x] **Tag Explorer screen dropped.** Component deleted; #tag PARSING kept in
      the engine (feeds export + the new library/archive search).
- [x] **Journal polish:** entries are tappable cards with spacing, long ones
      clamp to 3 lines with ellipsis, tap opens the review/edit/delete sheet
      (edit changes text only — ts/dayKey/XP untouched; delete re-folds).

### TIER C — editor ergonomics & bio-scan generalization

- [x] **Directive editor controls.** DONE (Tier C, 1). Area + Schedule are
      dropdowns (schedule sub-controls — weekday toggles / N-per-X inputs —
      still render below the selected kind); anchor input has a datalist of
      the user's OWN active directives ("after <name>") with free text as
      fallback; charge is a 1–5 slider with a ⚡ readout. Verified live.
- [x] **Global quiet hours + master notification switch.** DONE (Tier C, 2).
      `Reminders` gained `enabled` (master) + `quiet {on,start,end}`. Gated/
      clamped inside `localPings` — the single ping source — so push AND
      in-app inherit it: master off → zero pings; quiet hours DEFER any ping
      in-window to when quiet lifts (overnight wrap handled). Master off also
      hides ping options in the directive editor and bio-metric add form
      (shows a "globally off" hint). Engine tests added (5). Verified live.
- [x] **Bio-scan generalization.** DONE (Tier C, 4). ONE unified `BioScanCard`
      replaces the separate Weigh-in + Custom-Bio-Metrics cards. A `+` adds a
      metric from presets (weight, blood pressure, glucose, resting HR, blood
      oxygen, body temp) or custom. Each row: log field, ⓘ (trend chart with
      numbers + full history + UNDO last reading), edit (custom → pings on/off
      + window; weight → cadence). Weight is no longer hardwired — it shows
      once it has data or is added from the `+` (new `weightTracked` setting);
      existing users' bodyLogs surface it automatically. Doctor use case ("BP
      twice a day") is the headline empty-state copy. Undo added for both
      bodyLogs and bioReadings. Verified live (empty state → add weight → add
      BP → log reading).
      DESIGN NOTE (deliberate, transparent): weight stays backed by `bodyLogs`
      (keeps its cadence-based XP spacing + lbs/kg trend) rather than migrating
      into `bioReadings`. A storage migration of real weight history with no
      test export is the one destructive move here for purely-internal tidiness
      — not worth the risk. Unification is at the UI layer. If we ever want a
      single store, do it WITH Michael's export in hand.
- [x] **Reading/learning one-shots.** DONE (Tier C, 3). A "One-time thing"
      checkbox in the add row → creates the item already finished and drops
      straight into a session log (feeling); it never lingers in the feed
      waiting for "finish". Verified live.
- [x] **Codex growth.** DONE (Tier C, 3). +7 wellbeing presets (water-before-
      caffeine, meds/vitamins, morning sunlight, move, reach out to a human,
      reset a space, screens-down). New directive editor has a "💡 Browse
      suggestions" button → a picker that fills the whole form from a preset.
- [x] **Notification inventory view.** DONE (Tier C, 3). "all pings" in
      Reminder Uplink → one sheet listing every ping by source: System (6,
      real on/off), Directives (per-habit, uncheck clears), Bio-metrics
      (per-metric, uncheck clears). Verified live.

### TIER D — bullet-journal / gig upgrades (new feedback 2026-07-06) — COMPLETE

- [x] **Gig migration popup (the BuJo carry-over ritual).** DONE. New
      `GigMigration` modal (`components/GigMigration.tsx`): on the first open
      of a new day, AFTER the boot greeting (gated on `lastBootDay===today` so
      the two never stack) and once per day (`gigMigratedDay` kv), any gigs
      still open from prior days come up with checkboxes — carry-all by
      default, uncheck to "let go". "Carry N forward" retires the unchecked;
      "Keep them all for now" is the escape hatch. Forgiving copy ("Fresh
      sheet, choom… let the rest go, no guilt"). No Dexie bump needed —
      `retiredDay?` is an un-indexed field; board filter is
      `!retiredDay && (!doneTs || doneDay===today)`; export covers it (gigs
      table already exported); retiring earns/costs no XP. Verified live.
      NOTE: left the current silent auto-carry setting OUT for now (no config
      knob before a real user complains it's naggy — the escape hatch covers
      it). The ✕ button still hard-deletes (explicit user intent); migration
      "let go" is the non-destructive path.
- [x] **Gig templates (quick-add dropdown).** DONE — datalist-first, zero
      schema: the gig input has a `<datalist>` seeded from the user's distinct
      past gig text, so "do the dishes" is one pick after the first type. A
      managed/curated template list stays deferred until it earns its keep.
      Verified live.

### TIER UX — screenshot walkthrough fold (2026-07-14, full report:
`docs/ux-eval-2026-07-14.md` — dual-lens: end user + clinician)

- [x] **PHQ-9 item-9 / score ≥15 → gentle crash-kit offer in screener
      results.** DONE. The single highest-value clinical item in the eval and
      it was cheap: a conditional in the results view, warm copy, never alarm
      language, response never logged (pillar 1 intact).
- [x] **Persistent crash-kit access.** DONE. Nav drawer entry added; no more
      below-the-fold-only path. Clinical standard: reachable from any screen.
- [x] **Install banner: one-tap ✕, dismissal remembered** (localStorage
      `DISMISS_KEY`), and the screenshot pipeline seeds the dismissal so docs
      images show the real app (finding G1).
- [x] **Goals: pace hint + last-period result.** DONE. "ahead" badge now says
      what pace keeps you there; the 70%-empty screen shows last period's
      outcome.
- [x] **Copy/polish batch (rec #6).** DONE: Resting-HR placeholder fixed (bpm
      example, not "120/80"); screener history disambiguated ("last: N/27");
      vitals naming collision resolved (mood check-in no longer called
      "vitals"); System's area emoji now labeled (icon + area name); "OPEN
      CODEX" gained a clarifying subtitle; Feed one-time checkbox no longer
      detaches from its label (`.check-label-text`); ⚡/▣ chips are
      tap-to-explain buttons with inline copy (finding G4); LINKED→ON-GRID
      (finding G3); Reconfig context clarified.
- [ ] **Bottom tab bar** (finding G2, rec #3 — Directives / Grind / Telemetry).
      The biggest single flow improvement per the eval; needs Michael's call
      because it reshapes the nav-drawer customization he just got.
- [x] **Trend views.** DONE. `src/engine/trend.ts` (mood 30/90d + PHQ-9/GAD-7
      over time) → SVG sparklines in Telemetry (gaps stay gaps) + plain-English
      trend-direction lines in the Trauma Team export (rec #4). 7 engine tests.
- [x] **"Repeat last workout" one-tap.** DONE (rec #5). Re-logs the last
      session's shape (score not copied — it's a result, not the workout).
- [x] **Small carried items.** DONE: Training history rows expand to show sets;
      Feed 📝 rows expand to show the note; weight delta is opt-in (default off,
      ED-adjacent); crash-kit overlay got a fuller scrim.
- [ ] **Bottom tab bar** still deferred to Michael (see above).

### TIER E — daily-driver batch 2 (Michael, 2026-07-15)

Bugs/ergonomics first, features after (same ranking principle as v3).

- [x] **Boot greeting / pings banner needs a ✕.** Shipped: ✕ dismiss on both
      MissedPing and GoalBanner/PACE strips, dismissal persisted per period
      (localStorage) so it stays gone until the next cycle.
- [x] **iOS: UI bleeds past the viewport edge when hydration is full.**
      Shipped: over-goal glow clipped at the gauge edge (overflow +
      border-radius on the water fill in tokens.css); verified via screenshots
      (shots/tier-e-vitals-note.png era batch).
- [x] **Fixed header.** Shipped: sticky top bar + iOS safe-area inset
      (tokens.css); verified via Playwright (shots/header-menu-open.png).
- [x] **Vitals: delete a mistaken check-in.** Shipped: `undoLastMood()` in
      repo.ts (delete + moodLogs tombstone + refreshPlayer, mirrors
      undoLastBioReading) + "↩ undo last check-in" link-btn in MoodRow
      vitals trace. Typecheck clean; merge/export tombstone path verified.
- [x] **Vitals note field visible by default,** not hidden behind the +.
      Shipped: note input always rendered in MoodRow; + toggle removed.
      Verified via live screenshot (shots/tier-e-vitals-note.png).
- [x] **Gigs: drop the "carried over" tag** on migrated gigs — he wants the
      carry, not the label. Shipped: tag render + aria label removed in
      GigList; migration/carry logic untouched (shots/tier-e-gigs-no-tag.png).
- [ ] **Recurring gigs** ("pay the water bill" monthly). Feature, needs a
      scope pass: closest existing shape is a directive with a sparse
      schedule, but bills feel like gigs, not habits. NOTE (updated): monthly
      push is now POSSIBLE — the relay supports absolute one-shot epoch slots
      (pre-uploaded horizon + weekly SW re-sync, deployed 80b4d2f0). The old
      "weekly slot grid only" constraint no longer blocks this feature.
- [ ] **Gig history / reuse.** Partially exists: the gig input datalist is
      already seeded from distinct past gig text (Tier D). Check what ✕
      hard-delete does to that history and whether retired gigs need a
      browsable list before building anything new.
- [x] **Goals: + to log progress manually.** Shipped THIS batch's morning
      (8ea6428, manual-tally ＋1/undo). If Michael doesn't see it: service
      worker double-refresh dance (BUG-INTAKE.md), then re-report.
- [x] **Vault sync data-retention concern — answered, no work needed.**
      Blob is one KV value, client-side encrypted (PBKDF2 210k → AES-256-GCM),
      random 128-bit id, ciphertext-only server side, auto-expires after 120
      idle days (`VAULT_TTL`). KV value cap 25 MiB; years of logs ≪ that.
      Optional nicety, unranked: show blob size + "expires after 120 days
      idle" in the Data Vault card.

### TIER LT — flavor, reach, and the long game (carried forward)

- [ ] **Desktop support (design item — captured 2026-07-14, needs a design
      pass before code):** the app is phone-first but Michael uses desktop
      Chrome daily (the CORS bug was FOUND on desktop). Scope: a max-width
      multi-column layout for wide viewports (cards flow into 2–3 columns),
      keyboard affordances (the quick-log command line candidate below is the
      natural anchor), and hover states that don't lie on touch. Explicitly
      NOT: a separate desktop app. Decide layout approach (CSS grid
      breakpoints vs. container queries) in the design pass, not ad hoc.

- [~] **Goals system.** Core shipped across two passes. Base lens over logs
      (habits/reading/workouts, week/month/year targets) + coast-day pace nudge
      shipped earlier. **2026-07-15 pass (Michael's daily-driver bugs):** added
      a **manual-tally source** (＋1/undo on the goal — you can now move a goal
      by hand), a **lifelong horizon** (no reset, all-time count), and an
      **optional target** (blank = open-ended running count, no bar/pace). New
      `goalLogs` table (Dexie v10). STILL OPEN: pace-aware push reminders that
      fire on coast days (inverse of the fixed-day ping) — in-app coast banner
      exists; the push side needs the relay slot design. Scope in `TODO.md`.
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
      → **SHIPPED 2026-07-09** (`src/db/merge.ts`): pull now compare-and-merges
      (local wins on id conflict; vault-side gig completion/retire fills in;
      kv never syncs; absent tables left alone). New System toggle "pull +
      merge on every app open" (order on open: pull+merge, then push).
      Manual Pull full-replaces only onto an empty device. No separate inbox
      blob needed — merging the main vault covers it; trainer unchanged.
      Known edge (accepted): a row deleted locally between pushes can be
      resurrected once by a vault blob that still carries it.
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

### Decisions recorded — UX-eval pass (2026-07-14, don't relitigate)

- **Screener gating never blocks or logs.** The item-9/≥15 crash-kit offer
  appears IN the results view, after the score, as an offer — never a modal
  wall, never stored. Blocking results or logging the response would teach
  users to lie on the screener, defeating the "so answers stay honest" design.
- **No journaling/logging inside the crash kit** (eval's own recommendation,
  now doctrine): the zero-logging property IS the feature. Keep the kit
  read-only forever.
- **⚡/▣ explain is inline text, not a modal/InfoSheet.** One tap on the chip
  toggles a one-line explanation under the XP row. A sheet is heavier than
  the question deserves; the pattern is finding-G4-sized.
- **Bottom tab bar deferred to Michael, not refused.** It conflicts with the
  just-shipped nav-drawer customization (rename/reorder/stash). Both can't be
  the primary nav story; he picks after living with the drawer.
- **Install-banner dismissal is per-device localStorage, not vault state.**
  Wanting the banner hidden is a device fact, not user data — it shouldn't
  sync, export, or survive a vault restore onto a fresh device.

### Decisions recorded — daily-driver bug pass (2026-07-15)

- **Nav layout editing lives in System ▸ Menu Layout, not the drawer.** The
  per-row controls (rename/reorder/stash/drawer/delete) overflowed the 260px
  drawer horizontally. The drawer is navigation-only now; CLASSIFIED stays in
  the drawer so stashed pages remain reachable. (Dashboard block "Reconfig
  layout" is separate and unchanged.)
- **Goals earn no XP — manual ＋1 included.** `logGoalProgress` never calls
  refreshPlayer. Goals are a lens/measurement, not a game mechanic; gamifying
  a hand-tapped counter would just invite gaming the number.
- **Open-ended vs lifelong are separate axes.** Target-optional (open-ended =
  running count, no bar) is independent of horizon-lifelong (no reset). You can
  have a targeted lifelong goal ("100 total plunges, no deadline") or an
  open-ended weekly one ("just count this week"). Don't collapse them.
- **Manual goalLogs are a normal append-only event log** (amount can be
  negative to undo), same shape/rules as every other tracker; covered by
  export/import/merge. No XP, no rebuild dependency.

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
