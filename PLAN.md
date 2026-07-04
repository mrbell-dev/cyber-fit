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

## TIER LIST — the work, in order

### TIER S — now (tone, trust, Michael's daily loop)

- [x] **Welcome-back, not missed-ping.** Delete the MISSED PING ×N banner.
      Gap ≥ 2 days → warm full-screen popup ("Good to see you, choom. Ready
      for a new gig?") — no counts, no backlog, ever. Same-day nudge keeps
      current gentle copy. (Doctrine: CLAUDE.md rule 6.)
- [x] **Boot popups, gravedigger-style.** Morning + afternoon first-open
      greetings become one-tap full-screen modals; evening/late stay inline.
- [x] **Hydration units + goal:** ml/oz with US quick sizes (8/16 oz), fully
      user-defined goal (Michael: 128 oz). Gauge, config, XP, stats all honor it.
- [x] **+ quick-add on Directives header** (opens editor); remove the Suggested
      Protocols card (suggestions fold into the + flow / library).
- [x] **About: Buy Me a Coffee** → https://buymeacoffee.com/mrbell.dev (also
      fix README #support anchor).

### TIER A — daily-driver depth

- [x] **Charge & difficulty:** per-directive user-set charge (1–5 ⚡; water can
      be someone's boss fight, grounding a freebie) → XP is charge-weighted;
      global difficulty setting (easy/standard/hard) at first run, changeable.
- [x] **Vitals v2:** multiple readings/day with day trace, earlier readings in
      a distinct color, logged time + note shown inline, compact note field.
- [x] **Highlight ⇄ Journal toggle:** switchable on the card; journal entries
      stored (new table), tagged, feed Tag Explorer + med export.
- [x] **Gig list:** bullet-journal daily todos; unfinished gigs roll to the
      next day. Tasks, not habits — no streaks attached.
- [x] **Workout form v2:** fields dynamic per style (time/distance only where
      relevant; sets/reps grid for lifts) + **templates** — re-logging a named
      workout pre-fills last session's sets/weights (progressive overload
      visible at a glance).
- [x] **Bio-scan v2:** user-defined metrics beyond weight (e.g. BP 2×/day for
      a doctor), each with optional reminders + a chart. House rule: anything
      recordable gets a chart or calendar if chartable.
- [x] **Reading v2:** label the feeling glyphs; types → Book, Audio, Video,
      Article, Studying, Class.
- [x] **Haptics** on completions/crits/level-ups (`navigator.vibrate`;
      Android-only, silent degrade on iOS — Michael has a test device).
- [x] **Med-team export (headline feature):** System Report → export last N
      days/weeks as a clean .md for a therapist/doctor — good vs bad days,
      journals, wins; sections togglable per audience (bio-scan for the doc,
      not the therapist). Design with care; this is the app's superpower.

### TIER B — insight, polish, onboarding

- [x] **Stats made personal:** telemetry tiles hide untracked domains; uptime
      grid → 28 days with tap-for-day-detail; Highlight Reel → 28 days;
      shields explained in-app.
- [x] **Directives + Library merge** into one searchable, categorized popout.
- [x] **Tag hints** at every input where tags work.
- [x] **Dev mode** (System): fire test pings, fake grants/crits/drops, preview
      popups — playtest without grinding.
- [x] **First-run guide + per-feature info screens** (what shields are, tips;
      pick difficulty, starter directives, units, optional uplink).

### TIER C — infrastructure

- [x] **Encrypted vault sync** (approved design): on-device AES-GCM with
      passphrase-derived key (PBKDF2/Argon2) → random vault id in KV/R2;
      second device pulls + decrypts. Server sees only ciphertext. No accounts
      (accounts-first was rejected: privacy, liability, migration gravity).
      Plus scheduled auto-export via File System Access into any synced folder.
      SHIPPED addendum: auto-push on every app open (opt-in) via a stored
      NON-EXTRACTABLE derived key — "scheduled" on the web means on-open, since
      PWAs can't run closed (no reliable background cron; none at all on iOS).
      Native ports (Tier LT) would unlock true background sync.
- [x] **Notification deep links:** tapping a workout ping opens straight into
      a record-workout popup (SW notificationclick → URL param → modal);
      client-side slot→kind map; relay stays schedule-blind.

### TIER LT — long-term (research done 2026-07-03; build when ready)

- [x] **Finch feature comparison** — see table below.
- [ ] **Cyberware progression:** leveling installs visible cyberware on an SVG
      rig/avatar (arm at LVL 3, optic at LVL 6, spine at LVL 10…). Pure
      cosmetics, reduced-motion safe, never gates usability. Art is the real
      work — consider community PRs once the slot system exists.
- [x] **Native port + pricing research** — see findings below.
- [ ] **Native iOS/Android build** (Capacitor; after playtest stabilizes).
- [ ] **Cyber-trainer SMS** (Michael-only, separate private repo).

#### Finch comparison — adopt / adapt / reject

| Finch feature | Call | Our version |
|---|---|---|
| Pet that grows with self-care | REJECT | The cutesiness we exist to avoid — our progression is the cyberware rig (cosmetic, no dependent creature to guilt you) |
| Guided journeys / reflections | ADAPT | Guided journal prompts (evidence-based expressive-writing style) as an optional Journal mode — see research queue |
| Breathing exercises | ADOPT | "Box breathing" preset exists; add a guided breathing overlay (animated, reduced-motion safe) — cheap, high value |
| First Aid Kit (crisis moments) | ADAPT | **"Crash Kit"** — offline grounding exercises (5-4-3-2-1, box breathing), your own Highlight Reel as evidence, crisis lines (988). Fits the cyberpsychosis lore perfectly and works with zero signal |
| Mood quizzes (anxiety/depression) | ADAPT-CAREFULLY | PHQ-9/GAD-7 are public domain; optional self-screeners whose scores feed the Trauma Team export. Needs careful framing — screeners, not diagnoses |
| Goal tracker + celebrate wins | HAVE | Directives + gigs + crits |
| Timer for focus | ADOPT | Simple focus timer attachable to a directive (ADHD body-doubling adjacent) |
| Acts of kindness suggestions | ADAPT | Occasional "good deed gig" suggestion in the gig list — optional, dismissible |
| Friends / send good vibes | REJECT (park) | Social requires identity — collides with zero-PII. Revisit only as E2E-encrypted share codes, never accounts |
| First-run guided setup | HAVE | Onboarding + Field Manual |

#### Native port + pricing — findings (verified 2026-07-03)

- **Apple fee waiver: nonprofits/edu/gov ONLY, and only for FREE apps**
  ([apple.com](https://developer.apple.com/help/account/membership/fee-waivers/)).
  A 99¢ app can never ride a waiver — even with a nonprofit wrapper. So iOS
  paid distribution means eating $99/yr; at 99¢ minus Apple's 15% small-business
  cut (~$0.84 net) that's ~120 sales/yr to break even.
- **Revised rollout order:** Google Play FIRST ($25 one-time, Michael has an
  Android test device, Capacitor gives real local notifications + haptics with
  no relay dependency) → iOS only if Play sales suggest ~120+/yr, or keep iOS
  as sideload/web-only until then.
- Web stays free forever; sideload builds published free with each release;
  store price honestly framed as licensing/hosting recovery. Native apps get
  true background sync + locally scheduled notifications (no relay at all).

#### RESEARCH QUEUE — things worth studying before building (the research todo)

- [ ] **Implementation intentions / habit stacking** (BJ Fogg, "after I pour
      coffee, I stretch") → an optional "anchor" field on directives; strongest
      evidence-based lever we don't use yet.
- [ ] **Self-compassion vs. streak framing** (Neff et al.) → audit all copy
      against it; self-compassion predicts habit recovery better than grit.
- [ ] **Expressive-writing prompts** (Pennebaker protocol) → guided Journal
      mode with rotating evidence-based prompts (also feeds Finch ADAPT above).
- [ ] **PHQ-9 / GAD-7 in consumer apps** — licensing (public domain), ethical
      framing, score trends in the Trauma Team export.
- [ ] **Crisis UX patterns** for the Crash Kit — 988/crisis-line integration,
      offline-first grounding exercises, no dark patterns around distress.
- [ ] **ADHD focus techniques** — body doubling, pomodoro variants → focus
      timer design.
- [ ] **Hydration science** — actual evidence-based defaults per body
      weight/activity vs. the 8×8 myth; smarter goal suggestions at onboarding.
- [ ] **Full open exercise DB import** (yuhonas/free-exercise-db, wger) —
      800+ movements with instructions, offline-bundled.
- [ ] **Declarative Web Push / iOS PWA improvements** — track Safari releases;
      each one may shrink the native-port motivation.
- [ ] **Capacitor deep dive** — LocalNotifications scheduling limits, IndexedDB
      persistence inside the wrapper, Play signing pipeline via CI.
- [ ] **Accessibility audit** — full axe pass + real screen-reader session;
      we check contrast but haven't done a VoiceOver/TalkBack walkthrough.
- [ ] **Localization feasibility** — string extraction cost now vs. later
      (cyberpunk voice is hard to translate; scope carefully).

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
