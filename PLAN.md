# CYBER//FIT — Plan & Status

Cyberpunk self-improvement PWA. React 18 + Vite + TS + vite-plugin-pwa on GitHub Pages;
all data local (Dexie/IndexedDB); optional opt-in push via a Cloudflare Worker.
Pure-core engine pattern (see CLAUDE.md).

## STATUS

- [x] **Phase 0 — Shell:** scaffold, Electric City theme, bottom nav, Install prompt,
      icons, deploy workflow, LICENSE/README/CLAUDE.md/PLAN.md
- [ ] **Phase 1 — Habits + water** (usable daily driver)
- [ ] **Phase 2 — Gamification + mood**
- [ ] **Phase 3 — Workouts + reading/learning + stats + export/import**
- [ ] **Phase 4 — Push reminders (opt-in) + self-host docs**
- [ ] **Phase 5 — Augment catalog + fx + v1.0**

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
