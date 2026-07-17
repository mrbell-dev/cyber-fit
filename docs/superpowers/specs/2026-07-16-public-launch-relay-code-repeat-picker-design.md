# Public launch + relay access code + repeat-workout picker — design

Date: 2026-07-16. Approved by Michael in-session.

Two independent features. Goal of #1: open cyberfit.dev to smoke testers while
keeping **all billable Cloudflare traffic** (every relay request) behind a
shared access code, so free-tier quota can't be blown by strangers. Goal of #2:
repeat any past workout, not just the most recent one.

## 1. Go live: drop the site gate, lock the relay

### App worker (gate removal)

- Delete `gate/index.mjs` and remove `main = "gate/index.mjs"` +
  `run_worker_first = true` from `wrangler.toml` (the removal path the gate
  file itself documents). Redeploy.
- Result: the app is served as pure static assets — free, no worker
  invocations, so public smoke-test traffic costs nothing and can't touch the
  100k/day quota.

### Relay worker (access code)

- New Cloudflare secret on the relay: `ACCESS_CODE` (set to the current
  playtest code so existing testers' code keeps working).
- **Every route except `GET /health` and `OPTIONS` requires the code** —
  all POSTs (`/subscribe`, `/unsubscribe`, `/test`, `/vault`) **and**
  `GET /vault`. Michael's explicit call: no exceptions; syncing from a new
  device means entering the code there too.
- Transport: request header `x-cf-access: <code>`, checked constant-time
  (reuse the gate's `constantTimeEqual` pattern) before route dispatch.
  Missing/wrong → `401 {error:"access code required"}`.
- Losing the code is not a stranding risk: you can't subscribe without the
  code in the first place, and a browser's notification-permission revoke
  silences pushes regardless.

### Stale-subscription reaping (keep the sub list honest)

- KV writes for subscriptions get `expirationTtl` = 30 days.
- `syncPush()` already re-uploads on every app open (and tapping a push opens
  the app), so any active user refreshes their TTL constantly. A device with
  no opens, no push clicks, and no sync for 30 days simply expires out of KV —
  the cron never sends to it again. No new cron logic, no engagement tracking.

### App UI

- First time the user enables reminders (ReminderUplink) or touches vault
  sync (System screen), prompt for the access code. Store it in settings
  (Dexie, alongside relayUrl); send it as the `x-cf-access` header on every
  relay call — `postJson` in `src/ui/notify.ts`, the vault fetches in
  `src/ui/screens/System.tsx`, and the service worker's background `syncPush`
  payload bundle (so SW re-upload keeps working with the app closed).
- 401 from the relay → "ACCESS DENIED — bad code" in the existing beta voice,
  re-prompt. Self-hosted relays (custom relayUrl) may leave the code blank.

### Doctrine check

- Push stays nice-to-have: nothing else gates on the code (rule 4).
- The code is a shared secret, not identity; the TTL is a timestamp already
  implied by the subscription itself — zero-PII holds (rule 5).

## 2. Repeat any past workout (picker, pre-fills form)

- `src/ui/screens/Training.tsx` already has the template mechanic ("repeating
  a known workout pre-fills the last session"); the `↻ Repeat last` button
  hardcodes `history[0]`.
- Replace it with `↻ Repeat…` opening a picker that lists **every distinct
  workout name in history** (most recent session per name, newest first) —
  **no cap**; someone attending 10 different classes a week sees all 10.
- Tapping an entry pre-fills the log form with that session for tweaking
  before save (Michael's chosen UX — not log-as-is).
- Pure UI over existing history: no engine, schema, or export changes.

## Verification

- `worker/test.mjs`: cases for 401 without/with-wrong code on every locked
  route, 200 with the code, TTL present on subscribe writes.
- Playwright: screenshot the repeat picker and the access-code prompt; send
  screenshots to Michael.
- Live: cyberfit.dev loads with no gate; `/subscribe` without the header
  returns 401; subscribe-with-code succeeds on a real device.

## Out of scope / settled

- No per-user codes or accounts (settled: no accounts).
- No push-click tracking — TTL refresh via app-open sync is the only signal.
- Vault blob TTLs unchanged (only subscription entries get the 30-day TTL).
