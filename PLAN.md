# CYBER//FIT — Plan & Status

## ROADMAP v2 (from TODO.md + playtest feedback — the active plan)

Ordered for daily-driver impact. Each item cites its source so intent survives.

### R1 — Tone & arrival (small, do first)
- [ ] **Kill MISSED PING as guilt.** Never show missed counts. Replace with:
      logged yesterday-ish → current gentle nudge copy; gap of 2+ days → warm
      welcome-back popup: "Good to see you, choom. Ready for a new gig?" (no
      numbers, no backlog). Doctrine is in CLAUDE.md rule 6.
- [ ] **Boot popups, gravedigger-style.** Morning + afternoon greetings become
      a full-screen modal (like gravedigger's win screen) shown once on first
      open, dismissed with one tap. Evening/late stay as the inline card.
      Voice: sample StreetSlang.md sparingly.
- [ ] **Haptics** on completions/crits/level-ups via `navigator.vibrate`
      (Android/Chrome only — iOS Safari doesn't support it; degrade silently).
      Michael has an Android device to test.

### R2 — Today screen (TODO.md)
- [ ] **User-defined difficulty / dynamic lightning:** per-directive "charge"
      value (1–5 ⚡) set by the user — water can be someone's 5⚡ boss fight,
      grounding someone's 1⚡ freebie. XP = charge-weighted. Level curve gains a
      difficulty setting (easy/standard/hard) chosen at first run, changeable.
- [ ] **+ quick-add** on the Directives card header (opens the editor; replaces
      the Suggested Protocols card at the bottom — suggestions move into the
      + flow / library).
- [ ] **Highlight ⇄ Journal toggle:** some days journaling beats highlighting;
      radio/tab switch on the card, both stored (journal = new table, tagged,
      feeds Tag Explorer + med-export).
- [ ] **Gig list (bullet-journal todos):** daily checklist; unfinished gigs roll
      forward to the next day (that's the bullet-journal migration mechanic).
      Gigs are NOT streak-bearing — they're tasks, not habits.
- [ ] **Hydration units** ml/oz with US-friendly quick sizes (8/16 oz) and
      user-defined goal (Michael: 128 oz). Config + gauge + XP goal all honor it.
- [ ] **Vitals (mood) multiple readings/day:** mood can swing; log many, show
      the day's trace, mark earlier readings in a different color, show logged
      time + note inline. Note field compact (not full-width w/ save button).

### R3 — Log screen (TODO.md + playtest)
- [ ] **Dynamic workout form:** time/distance fields only when relevant to the
      chosen style; sets/reps grid for lifts.
- [ ] **Workout templates:** repeating a named workout pre-fills the last
      session's sets/weights for one-tap re-log (progressive overload visible).
- [ ] **Bio-scan v2:** per-metric tracking beyond weight, user-defined (e.g. BP
      2×/day for a doctor), each with optional reminders and a chart. Rule:
      **anything recordable gets a chart or calendar view** if chartable.
- [ ] **Reading v2:** feeling glyphs need labels; item types become Book, Audio,
      Video, Article, Studying, Class.

### R4 — Stats screen (TODO.md)
- [ ] **Telemetry tiles dynamic:** hide tiles for domains the user doesn't track
      (no workout tile for someone who can't work out); explain shields in-app
      (info screens, R6). Uptime grid → 28 days with tap-for-day-detail.
      Highlight Reel → 28 days.
- [ ] **Med-team export:** "System Report → Export" produces a clean .md of the
      last N days/weeks for a therapist/doctor — good/bad days, journals, wins,
      optional sections togglable per audience (bio-scan for the doc, not the
      therapist). This is a headline feature; design it with care.
- [ ] **Tag hints** everywhere tags work (directives, highlights, journal, notes).

### R5 — System screen (TODO.md)
- [ ] **Directives + Library merge** into one searchable, categorized popout.
- [ ] **Dev mode** toggle: test pings, fire fake grants/crits/drops, preview
      popups — so playtesting doesn't require earning everything.
- [ ] **Data Vault sync:** encrypted vault sync (design already below) plus
      scheduled auto-export; "sync to Drive-like folder" via File System Access.
- [ ] **About:** Buy Me a Coffee link → https://buymeacoffee.com/mrbell.dev
      (replaces placeholder donate link; also fix README #support anchor).

### R6 — Onboarding & help (TODO.md "Total")
- [ ] First-run guided setup (pick difficulty, install starter directives, units,
      optional uplink) + per-feature info screens (what shields are, tips).

### R7 — Push UX
- [ ] **Notification deep links:** clicking a workout ping opens the app on a
      record-this-workout popup (SW notificationclick → URL param → modal).
      Requires slot→kind mapping client-side; relay stays schedule-blind.

### R-LT — Long-term (research before building)
- [ ] **Finch feature comparison** — inventory what Finch does (goals coach,
      first-run, reflections, breathing exercises, town/social) vs ours; decide
      what translates to cyberpunk without the cutesiness. Output: a table in
      this file with adopt/adapt/reject calls.
- [ ] **Cyberware progression** — leveling installs visible cyberware on a
      user avatar/rig (pure cosmetics; never gates usability — CLAUDE.md rule 7).
- [ ] **Native iOS/Android ports + pricing.** Capacitor wrap of this codebase.
      Model per Michael: stores charge ~$1 (one-time 99¢ where no remote push
      needed; or $1 per 3–6mo sub only if hosted push costs demand it); web
      version stays free forever (self-host push); sideloadable builds published
      free — store price is honestly framed as covering licensing/hosting.
      Research: Apple fee waiver ($99/yr — waivers exist only for nonprofits/edu/
      gov; a personal self-help app likely does NOT qualify → verify, consider
      forming a nonprofit later or eating the fee), Google Play $25 one-time.
      PWA remains the canonical free path regardless.



Cyberpunk self-improvement PWA. React 18 + Vite + TS + vite-plugin-pwa on GitHub Pages;
all data local (Dexie/IndexedDB); optional opt-in push via a Cloudflare Worker.
Pure-core engine pattern (see CLAUDE.md).

## STATUS

- [x] **Phase 0 — Shell:** scaffold, Electric City theme, bottom nav, Install prompt,
      icons, deploy workflow, LICENSE/README/CLAUDE.md/PLAN.md
- [x] **Phase 1 — Habits + water** (usable daily driver)
- [x] **Phase 2 — Gamification + mood**
- [x] **Phase 3 — Workouts + reading/learning + stats + export/import**
- [x] **Phase 4 — Push reminders (opt-in) + self-host docs** — code complete; remaining:
      deploy the relay to a Cloudflare account (`worker/`, see SELF-HOSTING.md), bake
      `VITE_RELAY_URL` + `VITE_VAPID_PUBLIC_KEY` into the Pages build, test on real
      iPhone (A2HS) + Android
- [x] **Phase 5 — Augment catalog + fx + polish** (v1.0 tag after real-device push test)

## Why this app exists

Habit apps either punish you for missing days (anxiety trap) or drown you in cutesy
grind (Finch). cyber-fit is ADHD-first: 1–2-tap logging, flexible completion, streak
*shields* instead of streak *loss*, fast feedback, variable rewards — wrapped in a
cyberpunk skin, free and open source, with zero tracking.

Research anchors: habit automation with ADHD takes ~106–154 days (design for the long
haul, forgive everything); streak freezes cut at-risk churn ~21% (Duolingo); variable
rewards beat fixed ones; heavy gamification dies in weeks — light/medium retains.
Gamification scaffolds initiation, then real progress data takes over.

## Design pillars (non-negotiable)

1. **Off-grid by design** — 100% functional offline forever; push is nice-to-have only.
2. **Zero PII** — nothing leaves the device except opt-in push subscription + slot
   numbers; TLS everywhere; push payloads E2E-encrypted (RFC 8291) and generic.
3. **Forgiving by default** — skip ≠ fail; shields auto-absorb misses; "reboot", never
   "failure"; retroactive "log for yesterday".
4. **1–2 taps to log anything** on the Today screen.
5. **Cosmetic-only rewards** — augments unlock themes/fx, never functionality.

## Data model (event log + rebuildable snapshot)

Append-only Dexie tables (source of truth): `habitLogs, waterLogs, workoutLogs,
moodLogs, readingLogs, rewardEvents` + entity tables `habits, routines, readingItems`
+ `kv` (settings, PlayerState snapshot).

Every event stores `ts` **and** `dayKey` computed at log time (`dayStartHour` default
3 AM). All streak/schedule math uses dayKeys only.

- **Habit** schedules: `daily | weekdays(days[]) | timesPerWeek(target)`; optional
  `domain:"learning"`; optional per-day `target` for partial credit.
- **HabitLog** `kind: "done" | "skip"` — skip preserves streaks.
- **ReadingItem** (book/article/audiobook) + **ReadingLog** sessions with optional
  post-reading `note` + `feeling` (1–5).
- **PlayerState**: xp, level, freezeTokens (cap 3), per-habit + global + learning +
  reading streaks, unlockedAugments, per-source daily XP caps. Rebuildable from logs
  via `engine/rebuild.ts`.

## Gamification

Base XP: habit 10 · water goal 15 · workout 25 · mood 10 · reading 15 (+10 with note)
· first-log-of-day 20 · all-domains combo 30. Per-source daily caps kill grinding.
Crit rolls seeded on event id (deterministic): ~15% "CRITICAL SYNC" 2×, ~4% data-shard
drop → random augment. Level curve `xpToNext = 100 + 50*level`, styled
"LVL 7 // FIRMWARE v0.7". Freeze tokens: +1 per 5-day global streak, cap 3, auto-spend
("shield absorbed the hit"). Weekly SYSTEM REPORT card, positively framed.

## Reminder calendar spec (Phase 4 — user requirements)

A recurring-notification editor in SYSTEM, not just fixed times:
- **Per-reminder recurrence:** N times/day between a wake window (e.g. water ×5,
  09:00–21:00, evenly spaced), specific weekdays (workout Tue/Wed/Thu), daily at a
  time (end-of-day "catch up the logs"), morning greeting.
- **Themed copy per reminder type**, e.g. morning: "Rise and shine, Night City.";
  water: "Hydrate the wetware."; workout: "Chrome needs maintenance."; catch-up:
  "Sync your logs before lights out." Copy lives client-side; the push payload stays
  generic when using a shared relay (privacy), but self-hosters can enable themed
  payloads since it's their own server.
- Client converts the schedule to 15-min UTC slots for the worker; the full schedule
  never leaves the device — only the slot numbers.

**Self-hosting the relay — including from a home network:** sending web push only
needs OUTBOUND https to the browser vendors' push endpoints — no open ports, no
static IP, no domain. Any always-on box (Raspberry Pi, NAS, old laptop) running the
same worker code under Node + node-cron works. The only wrinkle is getting the push
subscription + slots INTO the box: LAN URL while on home Wi-Fi, paste-the-JSON, or
Tailscale/WireGuard. Document all this in the repo wiki (linked from About →
"self-host the notification relay") and ship `worker/` so it runs on both Cloudflare
and plain Node.

## Cyber-trainer SMS companion (backlog — Michael-only, NOT part of the OSS app)

Personal sidecar: text a "cyber-trainer" that runs on Michael's own hardware.
Architecture: Twilio number → webhook → small server on the home box (needs ONE
public HTTPS endpoint for Twilio: Tailscale Funnel or Cloudflare Tunnel, both free)
→ Ollama (qwen3.5-35b for quality or gemma4-26b for speed) with a trainer system
prompt → reply via Twilio API. Context: the cyber-fit Data Vault JSON exported to a
folder the server watches, so the trainer can say "you're at 750ml, two pings behind."
Costs: ~$1.15/mo for the number + ~$0.0079/SMS. Twilio requires A2P registration for
US traffic (one-time hassle, fine for personal low volume). Kept out of the app repo —
it would violate the zero-PII/zero-server design pillar; lives as its own private repo.

## Encrypted vault sync (backlog — approved 2026-07-03, next up)

Account-free cross-device sync: app encrypts the export blob ON-DEVICE
(AES-GCM, key derived from a user passphrase via PBKDF2/Argon2) and PUTs it to
the relay under a random vault id; another device enters vault id + passphrase
and pulls/decrypts. Server holds only ciphertext it cannot read; no accounts,
no email, no PII. Storage: Workers KV (small blobs) or R2. Deliberately chosen
over online accounts — accounts-first was considered and rejected (privacy
promise, liability, cost, migration gravity).

## Cross-device sync idea (backlog)

The Data Vault JSON can already be dropped in any cloud drive manually. Optional
future: File System Access API "link backup file" (pick a file inside the Google
Drive/Syncthing/Nextcloud sync folder; app re-exports to it on change) — gets
cross-device backup with zero OAuth, zero Google API dependency, zero new servers.
Full Drive API integration is deliberately avoided (OAuth client + Google dependency
contradicts the off-grid ethos).

## Push worker (Phase 4)

`worker/` — Cloudflare Worker, KV store, `pushforge` VAPID, cron `*/15`. Client snaps
reminder times to 15-min UTC slots and re-syncs on every open (DST). Endpoints:
`POST /subscribe`, `POST /unsubscribe`, `GET /health`; CORS locked to app origin;
no logging. Central instance by default + documented self-hosting (`wrangler deploy`
on your own free account; System screen accepts a custom worker URL + VAPID key).
Offline fallback: on-open MISSED PING banner. iOS: A2HS + 16.4+ required for push.

## Theme

Default palette **Electric City**: bg `#1B1B2A`, magenta `#FF007A`, green `#00FFB3`,
purple `#A700FF`, yellow `#FFEA00`. Green/yellow are text-safe on navy; magenta/purple
are accent-only. Fonts: Chakra Petch (display) + IBM Plex Sans/Mono (OFL, self-hosted).
Alt palettes ship as unlockable augments. Motion fx double-gated (reduced-motion +
toggle).
