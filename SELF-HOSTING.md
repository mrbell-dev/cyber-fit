# Self-hosting the notification relay

The relay is deliberately tiny: it stores **only** an anonymous push subscription
(a random URL your browser vendor mints — no identity in it) plus the 15-minute
time slots you chose. Everything else stays on your device. If even that is more
than you want to share with a stranger's relay, run your own. Two ways:

## Option A — your own free Cloudflare account (~5 minutes)

```bash
cd worker
npm install
npx @pushforge/builder vapid          # prints a public key + private JWK
npx wrangler kv namespace create SUBS # paste the id into wrangler.toml
npx wrangler secret put VAPID_PRIVATE_JWK   # paste the private JWK
npx wrangler deploy
```

Then in the app: **System → Reminder Uplink → self-hosting?** — enter your
`https://cyber-fit-relay.<you>.workers.dev` URL and the VAPID **public** key.
Free tier limits (100k requests/day, cron included) are ~1000× more than one
person needs.

## Option B — a box on your home network (Pi, NAS, old laptop)

A common misconception: you do NOT need an open port, static IP, domain, or
reverse proxy to **send** web push. Sending is an *outbound* HTTPS POST to
Apple's/Google's push servers. Any always-on machine can do it:

```js
// relay-home.mjs — node 20+, npm i @pushforge/builder
import { buildPushHTTPRequest } from "@pushforge/builder";
import { readFileSync } from "node:fs";

const { privateJWK, subs } = JSON.parse(readFileSync("relay-config.json", "utf8"));

setInterval(async () => {
  const now = new Date();
  const slot = Math.floor((now.getUTCDay() * 1440 + now.getUTCHours() * 60 + now.getUTCMinutes()) / 15) * 15;
  for (const { subscription, slots } of subs) {
    if (!slots.includes(slot)) continue;
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK,
      subscription,
      message: { payload: { title: "cyber-fit", body: "Time to sync." }, adminContact: "mailto:you@example.com" },
    });
    await fetch(endpoint, { method: "POST", headers, body });
  }
}, 15 * 60 * 1000);
```

The one wrinkle is getting your subscription JSON *onto* the box, since your
phone can't POST to a machine with no public URL. Pick one:

1. **LAN sync** — run the relay's `/subscribe` endpoint on the box and open the
   app while on home Wi-Fi (`http://` LAN origins can't receive push themselves,
   but they can *receive your subscription upload* just fine).
2. **Paste it** — the app can show your subscription JSON; paste it into
   `relay-config.json` by hand. Set-and-forget.
3. **Tailscale/WireGuard** — give the box a private HTTPS URL only your devices
   can reach, and put that URL in the app's self-host settings.

Because you own the relay, you can also edit the payloads to the themed copy
("Rise and shine, Night City.") — on a shared relay payloads stay generic so the
relay learns nothing about which reminder is which.

## What a relay operator could ever see

Whether shared or self-hosted: an opaque push endpoint, encrypted payload blobs
it created itself, and slot numbers. Push payloads are end-to-end encrypted
(RFC 8291); Apple/Google can't read them in transit either. There is no name,
no email, no IP log, no analytics. The worker code in `worker/` is short — read
it, that's the whole point of open source.
