// cyber-fit push relay — Cloudflare Worker.
//
// Privacy contract (enforced here, documented in the app + README):
//   * Stored: anonymous push subscription + slot numbers. Nothing else.
//   * No logging of IPs, user agents, or request bodies.
//   * Push payloads are generic; they're E2E-encrypted in transit (RFC 8291).
//   * TLS is mandatory (workers.dev / custom domains are HTTPS-only).

import { buildPushHTTPRequest } from "@pushforge/builder";
import { deleteSub, listSubs, putSub, slotOf, validateRecord } from "./store.mjs";

// ALLOWED_ORIGIN is a comma-separated allowlist (a single ACAO value can't
// cover both cyberfit.dev and www) — echo the request's Origin iff listed.
function cors(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin") ?? "";
  const allow = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export default {
  async fetch(request, env) {
    const headers = cors(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, headers);
    }

    // Encrypted vault sync: we store ciphertext we cannot read, under a
    // random 128-bit id. No accounts, no metadata, ~4-month TTL keeps KV lean.
    if (url.pathname === "/vault" && request.method === "GET") {
      const id = url.searchParams.get("id") ?? "";
      if (!/^[0-9a-f]{32}$/.test(id)) return json({ error: "bad id" }, 400, headers);
      const blob = await env.SUBS.get(`vault:${id}`);
      return blob ? json({ blob }, 200, headers) : json({ error: "not found" }, 404, headers);
    }

    if (request.method !== "POST") return json({ error: "POST only" }, 405, headers);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400, headers);
    }

    if (url.pathname === "/subscribe") {
      const err = validateRecord(body);
      if (err) return json({ error: err }, 400, headers);
      await putSub(env.SUBS, body);
      return json({ ok: true }, 200, headers);
    }

    if (url.pathname === "/unsubscribe") {
      if (typeof body?.endpoint !== "string") return json({ error: "bad endpoint" }, 400, headers);
      await deleteSub(env.SUBS, body.endpoint);
      return json({ ok: true }, 200, headers);
    }

    // Immediate test ping — pushes only to the subscription supplied in the
    // request (you can only ping yourself), so no auth needed.
    if (url.pathname === "/test") {
      const err = validateRecord({ subscription: body?.subscription, slots: [] });
      if (err) return json({ error: err }, 400, headers);
      const ok = await sendPush(env, body.subscription, "Uplink verified. Welcome to Night City.", "test");
      return json({ ok }, ok ? 200 : 502, headers);
    }

    if (url.pathname === "/vault") {
      const { id, blob } = body ?? {};
      if (!/^[0-9a-f]{32}$/.test(id ?? "")) return json({ error: "bad id" }, 400, headers);
      if (typeof blob !== "string" || blob.length > 400_000 || !/^[A-Za-z0-9+/=]+$/.test(blob)) {
        return json({ error: "bad blob" }, 400, headers);
      }
      await env.SUBS.put(`vault:${id}`, blob, { expirationTtl: 120 * 86400 });
      return json({ ok: true }, 200, headers);
    }

    return json({ error: "not found" }, 404, headers);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatch(env, new Date(controller.scheduledTime)));
  },
};

async function sendPush(env, subscription, text, type = "generic") {
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: JSON.parse(env.VAPID_PRIVATE_JWK),
      subscription,
      message: {
        // Generic on purpose — the service worker on the device picks the
        // themed, kind-specific copy locally. `type` only distinguishes
        // generic/motivation/test so the SW knows which template to use.
        payload: { type, body: text },
        adminContact: env.ADMIN_CONTACT || "mailto:admin@example.com",
        options: { ttl: 3600, urgency: "normal" },
      },
    });
    const res = await fetch(endpoint, { method: "POST", headers, body });
    // 404/410 = subscription expired or revoked — clean it up.
    if (res.status === 404 || res.status === 410) {
      await deleteSub(env.SUBS, subscription.endpoint);
      return false;
    }
    return res.ok || res.status === 201;
  } catch {
    // Never let one bad subscription break the batch; never log details.
    return false;
  }
}

// Motivation lines live in the (public, auditable) worker — the relay still
// knows nothing about the user; it just varies the encouragement.
const MOTIVATION_LINES = [
  "Still breathing, still winning. Keep going, choom.",
  "The grid remembers every small sync. Stack another one.",
  "You don't need max chrome — you need one more rep of being you.",
  "Night City chews up quitters. You're not on the menu.",
  "Preem work staying grounded today. The wetware thanks you.",
  "Small directives, big firmware upgrades. That's the whole game.",
  "Your streak is a shield. Your habits are the armor under it.",
  "Even V took rest days. Recover like it's a mission objective.",
  "One glass of water is a rebellion against entropy. Drink up.",
  "The most cyberpunk thing you can do is stay human. Nice work.",
  "Legends aren't built in a day. They're built daily.",
  "Check the highlight reel when it feels dark — the good frames are real.",
];

async function dispatch(env, now) {
  const slot = slotOf(now);
  const subs = await listSubs(env.SUBS);
  for (const record of subs) {
    const motivate = (record.motivationSlots ?? []).includes(slot);
    if (!motivate && !record.slots.includes(slot)) continue;
    const text = motivate
      ? MOTIVATION_LINES[Math.floor(Math.random() * MOTIVATION_LINES.length)]
      : "Time to sync.";
    await sendPush(env, record.subscription, text, motivate ? "motivation" : "generic");
  }
}
