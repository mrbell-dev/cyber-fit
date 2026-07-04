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

## TIER LIST v2 — chosen by judgment, in order
(v1 tiers S/A/B/C fully shipped July 2026 — see STATUS and git history.
Ranking principle: the app matters most on the user's worst night, so the
bad-night features outrank the good-day features.)

### TIER S — the bad-night tier (build first)

- [x] **Crash Kit.** One tap from anywhere (nav or Today header). Contents:
      guided box-breathing overlay (animated, reduced-motion safe), 5-4-3-2-1
      grounding exercise, YOUR OWN Highlight Reel replayed as evidence against
      the spiral ("these good frames are real — you logged them"), and crisis
      lines (988 call/text) — all fully offline except the phone call itself.
      Finch's First Aid Kit, rebuilt for the cyberpsychosis lore. This is the
      highest-human-value feature the app can add: everything else helps on
      normal days; this one helps on the day that counts.
- [x] **Self-compassion copy audit** (with Crash Kit copy written to the same
      standard). Research basis: self-compassion predicts habit RECOVERY better
      than grit — and recovery moments are exactly when copy is read most
      closely. Audit every string against "kind at 11pm after a bad week."

### TIER A — the strongest evidence levers

- [x] **Anchors (implementation intentions).** Optional field on a directive:
      "after [existing routine]" — "after I pour coffee → stretch". The
      single best-evidenced habit-formation technique not yet in the app, and
      it's one field + display copy on the habit card. Cheap, huge.
- [x] **Guided breathing as a reusable overlay** (shared with Crash Kit; also
      attachable to any directive — tap "Box breathing" → the overlay runs it).
- [x] **Self-screeners + Trauma Team integration.** Optional PHQ-9/GAD-7
      (public domain) on a user-chosen cadence like bio-scans; score TRENDS
      chart + inclusion in the export. Framed strictly as screeners, never
      diagnosis; scores stay on-device like everything else. This turns the
      Trauma Team export from useful into genuinely clinical — the app's
      sharpest differentiator, done carefully.

### TIER B — daily-driver upgrades

- [x] **Full exercise DB import** (yuhonas/free-exercise-db, public domain):
      800+ movements with instructions, offline-bundled behind the existing
      autocomplete. Michael lifts; this is a direct quality-of-life win.
- [x] **Focus timer** attachable to a directive (pomodoro-style, ADHD
      body-doubling adjacent) — completing a timed session logs the directive.
- [x] **Hydration science defaults:** onboarding suggests a goal from weight/
      activity instead of a flat 2L (8×8 is folklore); user always overrides.
- [ ] **Accessibility audit:** full axe pass + a real VoiceOver/TalkBack
      walkthrough. We verified contrast; we have not verified the experience.

### TIER LT — flavor, reach, and the long game

- [ ] **Cyberware rig:** SVG avatar gaining visible chrome per level (arm LVL 3,
      optic LVL 6, spine LVL 10…). Cosmetic only. Art is the bottleneck —
      build the slot system first, invite community art PRs.
- [ ] **Google Play native (Capacitor):** $25 one-time, real local
      notifications (no relay), true background sync, haptics guaranteed.
      First store target per the pricing research; iOS only if ~120 sales/yr
      materialize (Apple waiver is free-apps-only — verified).
- [ ] **Localization scoping** (string extraction cost; the voice is hard to
      translate — scope before promising).
- [ ] **Cyber-trainer SMS** (Michael-only, separate private repo).
- [ ] Watch: Declarative Web Push / Safari releases (each may shrink the
      native-port motivation).

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
