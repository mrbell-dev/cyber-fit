// cyber-fit push relay — Cloudflare Worker.
//
// Privacy contract (enforced here, documented in the app + README):
//   * Stored: anonymous push subscription + slot numbers. Nothing else.
//   * No logging of IPs, user agents, or request bodies.
//   * Push payloads are generic; they're E2E-encrypted in transit (RFC 8291).
//   * TLS is mandatory (workers.dev / custom domains are HTTPS-only).

import { buildPushHTTPRequest } from "@pushforge/builder";
import { deleteSub, listSubs, putSub, slotOf, validateRecord } from "./store.mjs";

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export default {
  async fetch(request, env) {
    const headers = cors(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, headers);
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

    return json({ error: "not found" }, 404, headers);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatch(env, new Date(controller.scheduledTime)));
  },
};

async function dispatch(env, now) {
  const slot = slotOf(now);
  const subs = await listSubs(env.SUBS);

  for (const record of subs) {
    if (!record.slots.includes(slot)) continue;
    try {
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK: JSON.parse(env.VAPID_PRIVATE_JWK),
        subscription: record.subscription,
        message: {
          // Generic on purpose — the app picks the themed copy locally.
          payload: { title: "cyber-fit", body: "Time to sync." },
          adminContact: env.ADMIN_CONTACT || "mailto:admin@example.com",
          options: { ttl: 3600, urgency: "normal" },
        },
      });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      // 404/410 = subscription expired or revoked — clean it up.
      if (res.status === 404 || res.status === 410) {
        await deleteSub(env.SUBS, record.subscription.endpoint);
      }
    } catch {
      // Never let one bad subscription break the batch; never log details.
    }
  }
}
