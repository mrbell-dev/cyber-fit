// PLAYTEST GATE — temporary. Fronts the static assets with a password check
// so only playtesters get in. The password lives as an encrypted Worker
// secret (GATE_PASSWORD); a correct POST /gate sets a signed, HttpOnly,
// Secure cookie (HMAC via GATE_KEY, 30-day expiry). Constant-time compares.
//
// To remove at launch: delete this file, drop `main` + `run_worker_first`
// from wrangler.toml, redeploy. Nothing else references it.

const COOKIE = "cf_gate";
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

const enc = new TextEncoder();

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(key, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasValidCookie(request, env) {
  const cookies = request.headers.get("Cookie") ?? "";
  const match = cookies.match(new RegExp(`${COOKIE}=([0-9]+)\\.([0-9a-f]+)`));
  if (!match) return false;
  const [, exp, sig] = match;
  if (Number(exp) * 1000 < Date.now()) return false;
  return constantTimeEqual(await hmacHex(env.GATE_KEY, exp), sig);
}

const LOGIN_PAGE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1b1b2a"><title>cyber-fit // access</title>
<style>
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
    background:#1b1b2a;color:#e8e8f2;font-family:ui-monospace,monospace}
  form{display:flex;flex-direction:column;gap:12px;padding:24px;width:min(90vw,340px);
    border:1px solid #ff007a;border-radius:10px;box-shadow:0 0 18px rgba(255,0,122,.35)}
  h1{font-size:16px;letter-spacing:.1em;margin:0;color:#00ffb3}
  p{margin:0;font-size:12px;color:#9a9ab0}
  input{background:#14141f;border:1px solid #34344e;border-radius:8px;color:#e8e8f2;
    padding:12px;font-family:inherit;font-size:15px}
  input:focus{outline:none;border-color:#00ffb3}
  button{background:rgba(255,0,122,.12);border:1px solid #ff007a;border-radius:8px;
    color:#e8e8f2;padding:12px;font-family:inherit;letter-spacing:.06em;cursor:pointer}
  .err{color:#ffea00;font-size:12px;min-height:14px}
</style></head><body>
<form id="f"><h1>CYBER//FIT — CLOSED BETA</h1>
<p>Access is gated during playtesting. Enter the access code.</p>
<input id="p" type="password" autocomplete="current-password" placeholder="access code" autofocus>
<button>Jack in</button><div class="err" id="e"></div></form>
<script>
document.getElementById("f").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const r = await fetch("/gate", {method:"POST",headers:{"Content-Type":"application/json"},
    body: JSON.stringify({password: document.getElementById("p").value})});
  if (r.ok) location.reload();
  else document.getElementById("e").textContent = "ACCESS DENIED — bad code";
});
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/gate" && request.method === "POST") {
      let password = "";
      try {
        password = String((await request.json()).password ?? "");
      } catch {
        return new Response("bad request", { status: 400 });
      }
      const ok = constantTimeEqual(await sha256Hex(password), await sha256Hex(env.GATE_PASSWORD));
      if (!ok) return new Response("denied", { status: 403 });

      const exp = String(Math.floor(Date.now() / 1000) + THIRTY_DAYS_S);
      const sig = await hmacHex(env.GATE_KEY, exp);
      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": `${COOKIE}=${exp}.${sig}; Path=/; Max-Age=${THIRTY_DAYS_S}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    if (await hasValidCookie(request, env)) {
      return env.ASSETS.fetch(request);
    }

    return new Response(LOGIN_PAGE, {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // Password form must never be frameable (clickjacking).
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
