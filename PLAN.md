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

- [ ] **Charge & difficulty:** per-directive user-set charge (1–5 ⚡; water can
      be someone's boss fight, grounding a freebie) → XP is charge-weighted;
      global difficulty setting (easy/standard/hard) at first run, changeable.
- [ ] **Vitals v2:** multiple readings/day with day trace, earlier readings in
      a distinct color, logged time + note shown inline, compact note field.
- [ ] **Highlight ⇄ Journal toggle:** switchable on the card; journal entries
      stored (new table), tagged, feed Tag Explorer + med export.
- [ ] **Gig list:** bullet-journal daily todos; unfinished gigs roll to the
      next day. Tasks, not habits — no streaks attached.
- [ ] **Workout form v2:** fields dynamic per style (time/distance only where
      relevant; sets/reps grid for lifts) + **templates** — re-logging a named
      workout pre-fills last session's sets/weights (progressive overload
      visible at a glance).
- [ ] **Bio-scan v2:** user-defined metrics beyond weight (e.g. BP 2×/day for
      a doctor), each with optional reminders + a chart. House rule: anything
      recordable gets a chart or calendar if chartable.
- [ ] **Reading v2:** label the feeling glyphs; types → Book, Audio, Video,
      Article, Studying, Class.
- [ ] **Haptics** on completions/crits/level-ups (`navigator.vibrate`;
      Android-only, silent degrade on iOS — Michael has a test device).
- [ ] **Med-team export (headline feature):** System Report → export last N
      days/weeks as a clean .md for a therapist/doctor — good vs bad days,
      journals, wins; sections togglable per audience (bio-scan for the doc,
      not the therapist). Design with care; this is the app's superpower.

### TIER B — insight, polish, onboarding

- [ ] **Stats made personal:** telemetry tiles hide untracked domains; uptime
      grid → 28 days with tap-for-day-detail; Highlight Reel → 28 days;
      shields explained in-app.
- [ ] **Directives + Library merge** into one searchable, categorized popout.
- [ ] **Tag hints** at every input where tags work.
- [ ] **Dev mode** (System): fire test pings, fake grants/crits/drops, preview
      popups — playtest without grinding.
- [ ] **First-run guide + per-feature info screens** (what shields are, tips;
      pick difficulty, starter directives, units, optional uplink).

### TIER C — infrastructure

- [ ] **Encrypted vault sync** (approved design): on-device AES-GCM with
      passphrase-derived key (PBKDF2/Argon2) → random vault id in KV/R2;
      second device pulls + decrypts. Server sees only ciphertext. No accounts
      (accounts-first was rejected: privacy, liability, migration gravity).
      Plus scheduled auto-export via File System Access into any synced folder.
- [ ] **Notification deep links:** tapping a workout ping opens straight into
      a record-workout popup (SW notificationclick → URL param → modal);
      client-side slot→kind map; relay stays schedule-blind.

### TIER LT — long-term / research first

- [ ] **Finch feature comparison:** inventory Finch (coach, reflections,
      breathing, town/social) vs ours; adopt/adapt/reject table added here.
- [ ] **Cyberware progression:** leveling installs visible cyberware on a user
      avatar/rig — pure cosmetics, never gates usability.
- [ ] **Native iOS/Android (Capacitor) + pricing:** web free forever
      (self-host push); sideload builds free; store price ≈ $0.99 one-time
      (or ~$1/3–6 mo sub only if hosted push costs demand) — honestly framed
      as licensing/hosting recovery. Research: Apple $99/yr fee waiver covers
      only nonprofits/edu/gov — a personal app likely doesn't qualify; verify,
      consider nonprofit wrapper, or eat the fee. Google Play $25 one-time.
      Native app gains local scheduled notifications (no relay needed).
- [ ] **Cyber-trainer SMS (Michael-only, separate private repo):** Twilio →
      tunnel → home box → Ollama with vault-export context. Never in the OSS
      app (would break zero-PII pillar).

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
