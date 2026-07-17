# Public Launch + Relay Access Code + Repeat-Workout Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open cyberfit.dev to the public while locking every relay request behind a shared access code, add 30-day subscription expiry, and let users repeat any past workout (not just the latest).

**Architecture:** The app worker's playtest gate is deleted (static assets are free — that alone removes the quota risk). The relay gains a `x-cf-access` header check (constant-time, against a new `ACCESS_CODE` secret) on every route except `GET /health` and `OPTIONS`; subscription KV writes get `expirationTtl` 30 days, refreshed by the existing app-open `syncPush`. Client-side, the code is a new `Settings.relayCode` field entered via a small input in Reminder Uplink and Vault Sync, and attached to every relay fetch (notify.ts, System.tsx vault, backupFile.ts auto-sync, sw.ts resync). The repeat picker is pure UI in Training.tsx reusing the existing `onName` template pre-fill.

**Tech Stack:** Cloudflare Workers (plain ESM, no framework), KV, React + Dexie PWA, node test script (`worker/test.mjs`), vitest, Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-public-launch-relay-code-repeat-picker-design.md`.
- Header name: `x-cf-access`. Secret name: `ACCESS_CODE`. TTL: `30 * 86400` seconds.
- Every relay route EXCEPT `GET /health` and `OPTIONS` requires the code — including `/unsubscribe` and `GET /vault` (Michael's explicit call, don't relitigate).
- If `env.ACCESS_CODE` is unset (self-hosted relay), no check — open. App-side, a blank code sends no header.
- Repeat picker: **no cap** on the number of distinct workouts listed; tap **pre-fills the form** (never logs as-is).
- Zero PII: the code is a shared secret, never identity. No new logging in the worker.
- Copy voice: 401 surfaces as "ACCESS DENIED — bad access code" (established gate voice).
- Repo: `/home/mrbell/web-dev/cyber-fit`. Shell is fish — write multi-step verification as bash script files, not inline `&&` chains with subshells.

---

### Task 1: Relay — access code + subscription TTL

**Files:**
- Modify: `worker/src/index.mjs` (auth check after `/health`, CORS `Access-Control-Allow-Headers`)
- Modify: `worker/src/store.mjs` (`putSub` gains `expirationTtl`)
- Test: `worker/test.mjs` (append; extend `mockKV.put` to record opts)

**Interfaces:**
- Consumes: existing `worker/src/index.mjs` default export `{ fetch(request, env) }`, `putSub(kv, record)`.
- Produces: relay returns 401 `{error:"access code required"}` when `env.ACCESS_CODE` is set and the `x-cf-access` header doesn't match; subscription KV entries carry `expirationTtl: 2592000`.

- [ ] **Step 1: Write the failing tests** — in `worker/test.mjs`, change `mockKV`'s put to record opts:

```js
    async put(k, v, opts) { map.set(k, { v, metadata: opts?.metadata ?? null, opts: opts ?? null }); },
```

Append at the end of the file (before the final `console.log`):

```js
// --- access code + TTL (fetch handler, mock env) ---
import worker from "./src/index.mjs";

const akv = mockKV();
const env = { SUBS: akv, ACCESS_CODE: "sesame", ALLOWED_ORIGIN: "*", VAPID_PRIVATE_JWK: "{}" };
const req = (path, { method = "GET", body, code } = {}) =>
  new Request(`https://relay.test${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: {
      "Content-Type": "application/json",
      ...(code !== undefined ? { "x-cf-access": code } : {}),
    },
  });
const subBody = { subscription: sub(9), slots: [540] };

// /health and OPTIONS stay open
assert.equal((await worker.fetch(req("/health"), env)).status, 200);
assert.equal((await worker.fetch(req("/subscribe", { method: "OPTIONS" }), env)).status, 204);
// everything else: 401 without or with a wrong code — including GET /vault and /unsubscribe
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody }), env)).status, 401);
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody, code: "wrong" }), env)).status, 401);
assert.equal((await worker.fetch(req(`/vault?id=${"ab".repeat(16)}`, { code: "wrong" }), env)).status, 401);
assert.equal((await worker.fetch(req("/unsubscribe", { method: "POST", body: { endpoint: sub(9).endpoint } }), env)).status, 401);
// right code works, and the subscription lands with a 30-day TTL
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody, code: "sesame" }), env)).status, 200);
assert.equal([...akv.map.values()][0].opts.expirationTtl, 30 * 86400);
// no ACCESS_CODE configured (self-host) → open
const openEnv = { SUBS: mockKV(), ALLOWED_ORIGIN: "*" };
assert.equal((await worker.fetch(req("/subscribe", { method: "POST", body: subBody }), openEnv)).status, 200);
// CORS allows the header
const preflight = await worker.fetch(req("/subscribe", { method: "OPTIONS" }), env);
assert.ok(preflight.headers.get("Access-Control-Allow-Headers").includes("x-cf-access"));
```

- [ ] **Step 2: Run to verify failure.** Run: `cd worker && node test.mjs`. Expected: FAIL on the first 401 assertion (currently 200) — if it fails earlier on the `import worker` (pushforge import issue in node), move the import to the top of the file with the other imports and rerun.

- [ ] **Step 3: Implement.** In `worker/src/index.mjs`:

In `cors()`, change the headers line:

```js
    "Access-Control-Allow-Headers": "Content-Type, x-cf-access",
```

Add below `cors()`:

```js
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

In `fetch`, immediately AFTER the `/health` block (so health + OPTIONS stay open, everything else is walled):

```js
    // Closed-beta wall: every billable route needs the shared access code.
    // Self-hosted relays that never set ACCESS_CODE stay open.
    if (env.ACCESS_CODE) {
      const code = request.headers.get("x-cf-access") ?? "";
      if (!constantTimeEqual(code, env.ACCESS_CODE)) {
        return json({ error: "access code required" }, 401, headers);
      }
    }
```

In `worker/src/store.mjs`, `putSub` — add the TTL (stale devices expire out of KV; any app open refreshes via syncPush):

```js
  await kv.put(key, JSON.stringify({
    subscription: record.subscription,
    slots: record.slots,
    motivationSlots: record.motivationSlots ?? [],
    oneShots: record.oneShots ?? [],
  }), { expirationTtl: 30 * 86400 });
```

- [ ] **Step 4: Run to verify pass.** Run: `cd worker && node test.mjs`. Expected: `worker logic tests OK`.

- [ ] **Step 5: Commit.**

```bash
git add worker/src/index.mjs worker/src/store.mjs worker/test.mjs
git commit -m "Relay: shared access code on every route (401 without x-cf-access) + 30-day subscription TTL"
```

---

### Task 2: Client plumbing — relayCode setting, header on every relay call, SW /register fix

**Files:**
- Modify: `src/engine/types.ts` (Settings interface, ~line 297 near `relayUrl`)
- Modify: `src/ui/notify.ts` (RelayConfig, relayConfig, postJson + its 5 call sites, storeResyncPayload)
- Modify: `src/ui/screens/System.tsx` (VaultSync: 3 relay fetches + 401 copy)
- Modify: `src/ui/backupFile.ts` (autoVaultSync: 2 relay fetches)
- Modify: `src/sw.ts` (ResyncPayload + the periodicsync fetch — also fixes the latent `/register` 404 bug: that route never existed on the relay; the correct route is `/subscribe`)

**Interfaces:**
- Consumes: relay behavior from Task 1 (`x-cf-access` header, 401).
- Produces: `Settings.relayCode?: string`; `relayConfig(): Promise<{url, vapidKey, code}>`; `postJson(url, path, body, code): Promise<{ok: boolean; status: number}>`; kv `pushResync` payload gains `code?: string`. Task 3's UI writes `relayCode` via `saveSettings`.

- [ ] **Step 1: Types.** In `src/engine/types.ts`, under `relayVapidKey?: string;`:

```ts
  /** shared-relay access code (closed beta) — sent as x-cf-access on every relay call */
  relayCode?: string;
```

- [ ] **Step 2: notify.ts.** Apply all of the following:

`RelayConfig` and `relayConfig`:

```ts
export interface RelayConfig {
  url: string;
  vapidKey: string;
  code: string;
}

/** Self-host settings win over the baked-in shared relay. */
export async function relayConfig(): Promise<RelayConfig> {
  const s = (await getSettings()) as { relayUrl?: string; relayVapidKey?: string; relayCode?: string };
  return {
    url: s.relayUrl || import.meta.env.VITE_RELAY_URL || "",
    vapidKey: s.relayVapidKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "",
    code: s.relayCode || "",
  };
}
```

`postJson` (status lets callers tell "bad code" from "offline"; 0 = network error):

```ts
async function postJson(url: string, path: string, body: unknown, code = ""): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(code ? { "x-cf-access": code } : {}) },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
```

Call sites — pass `relay.code` and adapt to the new return shape:

- `enablePush`:

```ts
  const r = await postJson(relay.url, "/subscribe", { subscription: sub.toJSON(), ...bundle }, relay.code);
  await storeResyncPayload(relay, bundle);
  await registerResync(reg);
  if (r.ok) return { ok: true };
  if (r.status === 401) return { ok: false, reason: "ACCESS DENIED — bad access code. Enter the beta access code above and try again." };
  return { ok: false, reason: "Relay unreachable — reminders will retry on next app open." };
```

- `syncPush`: `await postJson(relay.url, "/subscribe", { subscription: sub.toJSON(), ...bundle }, relay.code);` and `await storeResyncPayload(relay, bundle);`
- `disablePush`: `if (relay.url) await postJson(relay.url, "/unsubscribe", { endpoint: sub.endpoint }, relay.code);`
- `testPush`:

```ts
  const r = await postJson(relay.url, "/test", { subscription: sub.toJSON() }, relay.code);
  if (r.ok) return { ok: true };
  return { ok: false, reason: r.status === 401 ? "ACCESS DENIED — bad access code" : "relay declined the test ping" };
```

`storeResyncPayload` — take the whole RelayConfig so the SW gets the code:

```ts
async function storeResyncPayload(
  relay: RelayConfig,
  bundle: { slots: number[]; motivationSlots: number[] },
): Promise<void> {
  const reminders = await getReminders();
  await db.kv.put({
    key: "pushResync",
    value: {
      url: relay.url,
      code: relay.code,
      slots: bundle.slots,
      motivationSlots: bundle.motivationSlots,
      specs: await oneShotSpecs(reminders),
      quiet: reminders.quiet,
    },
  });
}
```

- [ ] **Step 3: sw.ts.** In `ResyncPayload`, add `code?: string;`. In the `periodicsync` handler, replace the fetch (this also fixes the `/register` 404 — that route never existed):

```ts
      await fetch(payload.url.replace(/\/$/, "") + "/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(payload.code ? { "x-cf-access": payload.code } : {}),
        },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          slots: payload.slots,
          motivationSlots: payload.motivationSlots,
          oneShots: shots.map((s) => s.at),
        }),
      }).catch(() => null);
```

- [ ] **Step 4: System.tsx VaultSync.** All three fetches gain the header; add a `hdr` helper at the top of `VaultSync`:

```ts
  const hdr = (relay: { code: string }) => (relay.code ? { "x-cf-access": relay.code } : {});
```

- `toggleAuto` GET: `const res = await fetch(`${relay.url.replace(/\/$/, "")}/vault?id=${id}`, { headers: hdr(relay) }).catch(() => null);`
- `push` POST: `headers: { "Content-Type": "application/json", ...hdr(relay) },` and after the fetch:

```ts
    if (res?.status === 401) return setMsg("ACCESS DENIED — bad access code (enter the beta code above)");
    if (!res?.ok) return setMsg("relay unreachable — try again later");
```

- `pull` GET: same `{ headers: hdr(relay) }`, and before the generic not-found message:

```ts
    if (res?.status === 401) return setMsg("ACCESS DENIED — bad access code (enter the beta code above)");
    if (!res?.ok) return setMsg("vault not found on relay");
```

- [ ] **Step 5: backupFile.ts autoVaultSync.** Both fetches gain the header (relay already in scope):

```ts
        const res = await fetch(`${base}/vault?id=${auto.id}`, {
          headers: relay.code ? { "x-cf-access": relay.code } : {},
        }).catch(() => null);
```

```ts
      const pushRes = await fetch(`${base}/vault`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(relay.code ? { "x-cf-access": relay.code } : {}) },
        body: JSON.stringify({ id: auto.id, blob, ...(baseVersion !== undefined ? { baseVersion } : {}) }),
      }).catch(() => null);
```

- [ ] **Step 6: Verify.** Run: `npm test` then `npm run build`. Expected: 63+ tests pass, tsc clean (noUnusedLocals — make sure no dangling imports).

- [ ] **Step 7: Commit.**

```bash
git add src/engine/types.ts src/ui/notify.ts src/sw.ts src/ui/screens/System.tsx src/ui/backupFile.ts
git commit -m "Client: send x-cf-access on every relay call; fix SW resync posting to nonexistent /register"
```

---

### Task 3: Access code UI (Reminder Uplink + Vault Sync)

**Files:**
- Create: `src/ui/components/AccessCodeField.tsx`
- Modify: `src/ui/components/ReminderUplink.tsx` (render above the enable button)
- Modify: `src/ui/screens/System.tsx` (render inside VaultSync, near the passphrase input)

**Interfaces:**
- Consumes: `Settings.relayCode` (Task 2), `saveSettings` from `src/db/repo.ts`, `useSettings` from `src/ui/hooks.ts`, `syncPush` from `src/ui/notify.ts`.
- Produces: `<AccessCodeField />` — self-contained, no props.

- [ ] **Step 1: Component.** Create `src/ui/components/AccessCodeField.tsx`:

```tsx
import { useEffect, useState } from "react";
import { saveSettings } from "../../db/repo.ts";
import { syncPush } from "../notify.ts";
import { useSettings } from "../hooks.ts";

/** Shared-relay access code (closed beta). Saved on blur; re-syncs push so a
 *  newly-entered code takes effect immediately. Self-hosters leave it blank. */
export function AccessCodeField() {
  const settings = useSettings();
  const [value, setValue] = useState("");
  useEffect(() => setValue(settings.relayCode ?? ""), [settings.relayCode]);
  const save = async () => {
    const code = value.trim();
    if (code === (settings.relayCode ?? "")) return;
    await saveSettings({ relayCode: code });
    await syncPush();
  };
  return (
    <div className="form-row">
      <input
        className="input"
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="access code (closed beta)"
        aria-label="Relay access code"
        autoComplete="off"
      />
    </div>
  );
}
```

- [ ] **Step 2: Mount in ReminderUplink.** Import it, then directly ABOVE the enable-button `form-row`:

```tsx
      <p className="placeholder">// closed beta: the shared relay needs an access code</p>
      <AccessCodeField />
```

- [ ] **Step 3: Mount in VaultSync (System.tsx).** Import it, render it immediately above the passphrase input row with the same one-line placeholder comment.

- [ ] **Step 4: Verify visually.** `npm run build`, then drive it with a throwaway Playwright script (copy a `scripts/demo-*.mjs` pattern, unique preview port): open System screen, screenshot the Reminder Uplink card and Vault Sync section showing the code field. Delete the script. **Send the screenshots to Michael.**

- [ ] **Step 5: Commit.**

```bash
git add src/ui/components/AccessCodeField.tsx src/ui/components/ReminderUplink.tsx src/ui/screens/System.tsx
git commit -m "Access code field in Reminder Uplink + Vault Sync (closed-beta relay wall)"
```

---

### Task 4: Repeat-any-workout picker (Training)

**Files:**
- Modify: `src/ui/screens/Training.tsx`

**Interfaces:**
- Consumes: existing `onName(value)` template pre-fill, `pastNames` (already distinct, newest-first because `history` is sorted `b.ts - a.ts`), `hasHistory`.
- Produces: UI only; nothing downstream.

- [ ] **Step 1: Replace one-tap repeat with the picker.** In `WorkoutCard`:

Delete the `repeatLast` function, the `repeated` state, and the `{repeated && ...}` block. Add state:

```tsx
  const [pickerOpen, setPickerOpen] = useState(false);
```

Replace the `{history?.[0] && (<button ... ↻ Repeat last ...>)}` block with:

```tsx
      {hasHistory && (
        <button
          className="btn ghost repeat-last"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
        >
          ↻ Repeat a workout…
        </button>
      )}
      {pickerOpen && (
        <div className="recent-list" role="group" aria-label="Past workouts to repeat">
          {/* every distinct workout ever logged — uncapped by design (10 classes/week is fine) */}
          {pastNames.map((n) => {
            const last = history!.find((w) => w.name === n)!;
            return (
              <div className="row-item" key={n}>
                <button
                  className="workout-row-btn"
                  onClick={() => {
                    onName(n);
                    setPickerOpen(false);
                  }}
                >
                  {n}
                  {last.style ? ` · ${WORKOUT_STYLES.find((s) => s.id === last.style)?.label ?? last.style}` : ""}
                </button>
                <span className="off-day-tag">{last.dayKey}</span>
              </div>
            );
          })}
        </div>
      )}
```

Picking pre-fills the form via `onName` (the existing "// loaded from last time — tweak and log" note appears), per the approved UX.

- [ ] **Step 2: Verify.** Run: `npm test && npm run build`. Expected: green, tsc clean (the deleted `repeatLast`/`repeated` must leave no unused imports — `logWorkout` is still used by `submit`).

- [ ] **Step 3: Verify visually.** Throwaway Playwright script: seed a few workouts with different names (log via the UI or Dexie), open Training, tap "↻ Repeat a workout…", screenshot the open picker, tap an entry, screenshot the pre-filled form. Delete the script. **Send both screenshots to Michael.**

- [ ] **Step 4: Commit.**

```bash
git add src/ui/screens/Training.tsx
git commit -m "Repeat any past workout: picker over distinct history pre-fills the form (uncapped)"
```

---

### Task 5: Set the secret, drop the gate, deploy, verify live

**Files:**
- Delete: `gate/index.mjs` (and the `gate/` dir)
- Modify: `wrangler.toml` (remove `main = "gate/index.mjs"` and `run_worker_first = true`; keep `[assets]` directory + binding)
- Modify: `CLAUDE.md` (gate references: Layout table's `gate/` row, "Known sharp edges" gate line, secrets list — GATE_PASSWORD/GATE_KEY out, ACCESS_CODE in), `PLAN.md` STATUS line ("playtest gate" → "public; relay behind access code")

**Interfaces:**
- Consumes: everything above, deployed together.
- Produces: the live site + locked relay.

- [ ] **Step 1: Set the relay secret.** Michael supplies the code value (reuse the current beta code so existing testers keep working). Run in `worker/`: `npx wrangler secret put ACCESS_CODE` (interactive paste).

- [ ] **Step 2: Deploy the relay first** (so the wall is up before the app ships the header): `npm run deploy:relay`.

- [ ] **Step 3: Drop the gate.** Delete `gate/`, remove the two wrangler.toml lines, update CLAUDE.md + PLAN.md as above. Run `npm test && npm run build`, then `npm run deploy`.

- [ ] **Step 4: Verify live** (bash script file, not inline — fish shell):

```bash
#!/usr/bin/env bash
set -e
# site is public — no gate redirect/login page
curl -s https://cyberfit.dev | grep -qv "CLOSED BETA" && echo "site: public OK"
# relay: health open, subscribe walled
test "$(curl -s -o /dev/null -w '%{http_code}' https://relay.cyberfit.dev/health)" = 200 && echo "health: 200 OK"
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST https://relay.cyberfit.dev/subscribe -H 'Content-Type: application/json' -d '{}')" = 401 && echo "subscribe no code: 401 OK"
test "$(curl -s -o /dev/null -w '%{http_code}' 'https://relay.cyberfit.dev/vault?id=00000000000000000000000000000000')" = 401 && echo "vault GET no code: 401 OK"
```

Expected: all four OK lines. Then on-device: Michael enters the code in Reminder Uplink on his iPhone, "Send test ping" arrives.

- [ ] **Step 5: Commit + push.**

```bash
git add -A
git commit -m "Go public: delete playtest gate; relay walled by ACCESS_CODE; docs updated"
git push
```

---

## Self-review notes

- Spec coverage: gate removal (T5), relay lockdown incl. /unsubscribe + GET /vault (T1), TTL reaper (T1), code prompt UI + settings storage (T2/T3), SW resync carries code (T2, plus the /register bug fix), 401 voice (T2), repeat picker uncapped + pre-fill (T4), worker tests + Playwright + live curl checks (T1/T3/T4/T5).
- Deliberate scope: `dispatch()`'s one-shot-prune `putSub` also refreshes TTL — acceptable; one-shots only exist for recently-active clients.
