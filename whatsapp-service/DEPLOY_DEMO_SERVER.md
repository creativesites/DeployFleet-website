# Deploying `whatsapp-service` to the DeployFleet demo server

At Winston's explicit direction, this deploys `whatsapp-service` (WA-0)
onto the same box that hosts the DeployFleet Odoo demo
(`199.192.23.46`, per the sibling `creativesites/DeployFleet` repo's own
`DEPLOYMENT.md`) — a deliberate deviation from
[`docs/whatsapp-intelligence-architecture.md`](../docs/whatsapp-intelligence-architecture.md)
§13's own recommendation to keep this on genuinely separate
infrastructure. That recommendation's reasoning still stands (a
WhatsApp-service incident should never become an incident on a box
hosting someone else's live production/staging Odoo instances) — this
runbook keeps the isolation that reasoning calls for at the container
level instead of the machine level: **its own directory, its own Docker
Compose file, its own Docker network, its own port, no shared volumes,
never touching the Odoo project's own `docker-compose.prod.yml`.**

**Read this whole document before running anything.** Every step below
assumes you already have SSH access to `199.192.23.46`. This runbook
was written by an AI session with no SSH access of its own to that box
— none of it has been executed or verified against the real server; it
is a concrete, ready-to-run procedure, not a confirmation that it works.

---

## 0. Inventory first — the same rule the Odoo project's own DEPLOYMENT.md uses

Before touching anything, SSH in and look:

```bash
ssh root@199.192.23.46
docker ps -a
ss -tlnp                       # or: netstat -tlnp
ls -la /opt/
cat /etc/nginx/sites-enabled/* 2>/dev/null   # or /etc/caddy/Caddyfile — whichever this box actually runs, if either
```

Confirm: what ports are already bound (the Odoo demo is on `4169`;
don't assume anything else is free — pick a genuinely unused port),
whether a reverse proxy already exists (needed for step 4), and that
`/opt/deployfleet` (the Odoo checkout) is not where you're about to put
anything — this deploy goes in its own sibling directory.

---

## 1. Clone this repo onto the server, in its own directory

```bash
mkdir -p /opt/deployfleet-whatsapp
cd /opt/deployfleet-whatsapp
git clone https://github.com/creativesites/deployfleet-website.git .
# (GitHub reports this repo moved to creativesites/DeployFleet-website —
# either URL works via GitHub's redirect; the clone remote will show the
# new name.)
cd whatsapp-service
```

Everything from here on happens inside `whatsapp-service/` — the rest
of the `deployfleet-website` checkout (the Next.js app) is irrelevant on
this server and can be ignored.

---

## 2. Generate the shared secret

This is the one secret both sides of the integration need, identically.
Generate it once, here, and never write it into any file in either git
repo:

```bash
openssl rand -hex 32
```

Copy the output — you'll paste it into two places: this server's `.env`
(step 3) and the DeployFleet Vercel project's environment variables
(step 8).

---

## 3. Create the service's `.env`

```bash
cd /opt/deployfleet-whatsapp/whatsapp-service
cp .env.example .env
```

Edit `.env` (`nano .env` or similar) and fill in:

```bash
PORT=8787                      # or whatever free port step 0 confirmed
WHATSAPP_GATEWAY_SECRET=<the value from step 2>
DEPLOYFLEET_WEBHOOK_URL=https://<your-deployfleet-vercel-domain>/api/whatsapp/webhook
LOG_LEVEL=silent
```

Use the actual production domain of the deployed DeployFleet Next.js
app for `DEPLOYFLEET_WEBHOOK_URL` (check the Vercel project's assigned
domain — e.g. `deployfleet.vercel.app` or a custom domain, whichever is
actually live). Get this wrong and inbound WhatsApp messages will
silently fail to forward (the service logs a warning and drops them,
per `src/webhook.ts` — it never crashes, but nothing reaches the CRM).

---

## 4. Build and run — isolated Compose file, isolated network, isolated volume

Create `docker-compose.yml` right here in `whatsapp-service/` (**do
not** add this service to the Odoo project's own compose file):

```yaml
services:
  whatsapp-service:
    build: .
    container_name: deployfleet-whatsapp-service
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:8787:8787"   # bind to localhost only — see step 5 for public exposure
    volumes:
      - wa-auth:/app/.wa-auth   # named volume — session credentials survive a redeploy
    networks:
      - whatsapp-service-net

networks:
  whatsapp-service-net:
    name: deployfleet-whatsapp-net

volumes:
  wa-auth:
    name: deployfleet-whatsapp-auth
```

Note the port binds to `127.0.0.1` only, not `0.0.0.0` — this container
is not directly internet-reachable yet on purpose (step 5 puts a
reverse proxy with TLS in front of it, since Vercel calling this
service's bearer-secret-authenticated API over plain HTTP would send
that secret in cleartext across the public internet).

```bash
docker compose build
docker compose up -d
docker compose logs -f    # Ctrl-C once you see "[whatsapp-service] listening on :8787"
```

Sanity check from the server itself:

```bash
curl -s http://127.0.0.1:8787/health
# {"ok":true}
```

---

## 5. Expose it publicly, with TLS

Vercel (where the Next.js app runs) needs to reach this service over
the public internet, and this service needs to reach Vercel's
`/api/whatsapp/webhook` — both directions carry the bearer secret, so
both need HTTPS, not plain HTTP.

**If this server already has a reverse proxy** (nginx/Caddy — step 0
told you which, if either): add a new site/vhost for a subdomain (e.g.
`wa.<your-domain>`) pointing at `127.0.0.1:8787`, get a cert (`certbot`
for nginx, or Caddy issues one automatically), and you're done — skip
to step 6 using `https://wa.<your-domain>` as the gateway URL.

**If there's no reverse proxy on this box yet**, the fastest correct
path is Caddy (one dependency, automatic Let's Encrypt, ~5 lines of
config) — but this needs a DNS A record for a subdomain (e.g.
`wa.yourdomain.com`) already pointed at `199.192.23.46` before Caddy can
issue a certificate:

```bash
# Install Caddy (Debian/Ubuntu):
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

cat >> /etc/caddy/Caddyfile <<'EOF'
wa.yourdomain.com {
    reverse_proxy 127.0.0.1:8787
}
EOF

systemctl reload caddy
```

Replace `wa.yourdomain.com` with the real subdomain once its DNS record
exists. Caddy handles the TLS certificate automatically on first
request.

If no domain is available at all, the disclosed fallback is binding
`docker-compose.yml`'s port to `0.0.0.0:8787` instead of `127.0.0.1` and
using `http://199.192.23.46:8787` directly with no TLS — workable to
get connected and testing, but the bearer secret then travels in
cleartext on every request; upgrade to a real domain + TLS before
relying on this for anything beyond a first connectivity test.

---

## 6. Point the Next.js app at the gateway

In the Vercel project's dashboard (Settings → Environment Variables for
the `deployfleet-website` project), set:

```
WHATSAPP_GATEWAY_URL=https://wa.yourdomain.com
WHATSAPP_GATEWAY_SECRET=<the same value from step 2>
```

Redeploy the Vercel project (or trigger a redeploy from a new commit —
env var changes need a redeploy to take effect). Once live,
`GET /api/admin/crm/whatsapp/status` in the admin dashboard should
report `configured: true`.

---

## 7. Connect a real WhatsApp number

Two ways — pick one, both call the same `/connect` endpoint, both
authenticated with the bearer secret from step 2:

**Pairing code (recommended — no screen needed on the server):**

```bash
curl -X POST https://wa.yourdomain.com/connect \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "260XXXXXXXXX"}'   # digits only, no +, the dedicated DeployFleet WhatsApp Business number

# poll until linkCode is set:
curl -s https://wa.yourdomain.com/status \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>"
# {"connected":false,"phoneNumber":null,"status":"connecting","qrDataUrl":null,"linkCode":"ABCD-1234"}
```

On the phone with that number: WhatsApp → Settings → Linked Devices →
Link a Device → "Link with phone number instead" → enter `ABCD-1234`.

**QR code (needs a way to view an image from the server):**

```bash
curl -X POST https://wa.yourdomain.com/connect \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>"

curl -s https://wa.yourdomain.com/status \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>" | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)['qrDataUrl']
b64 = data.split(',', 1)[1]
open('/tmp/wa-qr.png', 'wb').write(base64.b64decode(b64))
print('saved to /tmp/wa-qr.png — scp it to your machine and open it, or serve it and view in a browser')
"
```

Either way, confirm once connected:

```bash
curl -s https://wa.yourdomain.com/status -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>"
# {"connected":true,"phoneNumber":"260XXXXXXXXX","status":"connected",...}
```

---

## 8. End-to-end test

1. In the DeployFleet admin dashboard, open a real prospect's page and
   click **Verify number** — should flip to "Verified on WhatsApp" (or
   "Not on WhatsApp" if that number genuinely isn't registered).
2. Send that prospect a real WhatsApp message from the same page (or
   from `/admin/whatsapp`).
3. Reply from the prospect's actual phone — it should appear in
   `/admin/whatsapp` within a few seconds (the webhook forward is
   synchronous, not polled).

---

## Operating it afterward

```bash
cd /opt/deployfleet-whatsapp/whatsapp-service
docker compose logs -f              # tail logs
docker compose restart              # restart the container (session survives — .wa-auth is a named volume)
docker compose down && docker compose up -d --build   # redeploy after a git pull
```

To pull a new version of the service after a future code change:

```bash
cd /opt/deployfleet-whatsapp
git pull origin main
cd whatsapp-service
docker compose up -d --build
```

`git pull` never touches `.env` (git-ignored) or the `wa-auth` Docker
volume (external to the checkout) — a redeploy doesn't require
reconnecting WhatsApp.

## If it stops working

- `docker compose logs -f` first — `[baileys] ...` lines say exactly
  what's happening (reconnect attempts, disconnect reasons).
- A `logged_out` disconnect (someone removed the linked device from
  their phone, or the account got banned/restricted) requires
  reconnecting from scratch — step 7 again; this also deletes the saved
  credentials, so nothing auto-restores until you do.
- A container restart (`docker compose restart`, a redeploy, or the
  host rebooting) resumes the saved session automatically —
  `sessionManager.restoreIfSaved()` runs once on process boot and
  reconnects using the credentials in the `wa-auth` volume, no manual
  `/connect` call needed. If `GET /status` still shows `idle` a minute
  after a restart, check `docker compose logs` for
  `[whatsapp-service] saved session found — auto-restoring...` — if
  that line is missing entirely, the `wa-auth` volume is empty (a fresh
  connect via step 7 is needed); if it's there but connection never
  completes, the error right after it is the real problem to chase.
