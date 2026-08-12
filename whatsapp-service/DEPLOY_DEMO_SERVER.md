# Deploying `whatsapp-service` to the DeployFleet demo server

At Winston's explicit direction, `whatsapp-service` (WA-0) runs on the
same box that hosts the DeployFleet Odoo demo (`199.192.23.46`, per the
sibling `creativesites/DeployFleet` repo's own `DEPLOYMENT.md`) — a
deliberate deviation from
[`docs/whatsapp-intelligence-architecture.md`](../docs/whatsapp-intelligence-architecture.md)
§13's own recommendation to keep this on genuinely separate
infrastructure. That recommendation's reasoning still stands (a
WhatsApp-service incident should never become an incident on a box
hosting someone else's live production/staging Odoo instances) — this
keeps the isolation that reasoning calls for at the container level
instead of the machine level: **its own directory
(`/opt/deployfleet-whatsapp`), its own Docker Compose file, its own
Docker network, its own port, no shared volumes, never touching the
Odoo project's own `docker-compose.prod.yml` or the unrelated DogForce
stack already running on this box.**

This document reflects what was actually confirmed and run during the
real deploy session, not a generic guess — see the notes below on what
that session found.

---

## What this server already looked like before this deploy

Confirmed by inventory (`docker ps -a`, `ss -tlnp`, `/etc/nginx/conf.d/`)
before anything was touched:

- Containers already running: `deployfleet_prod_odoo` (port `4169`→8069,
  `4172`→8072), `deployfleet_prod_db`, `dogforce-prod-odoo` (8069, 8072),
  `dogforce-prod-db`, `dogforce-staging-db`, and — worth knowing about —
  **`dogforce-prod-whatsapp-bridge`**, DogForce's own unrelated WhatsApp
  integration, already live on port `3000`, published directly with no
  reverse proxy in front of it (its own `ODOO_WEBHOOK_URL` env var points
  at `http://odoo:8069/...` over the internal Docker network, not a
  public URL). Its existence confirmed a Node WhatsApp bridge runs fine
  on this exact box; it is otherwise unrelated to DeployFleet and was
  never touched.
- Nginx (RHEL-style config: `/etc/nginx/conf.d/*.conf`, not Debian's
  `sites-enabled`) already reverse-proxies `dogforcesecurityservices.com`
  to the DogForce Odoo containers, with a valid Let's Encrypt cert for
  that domain (`certbot certificates` confirmed it, valid into
  Oct 2026). DeployFleet's own demo has no domain of its own — it's
  reached by IP:port (`199.192.23.46:4169`).
- Port `8787` (this service's default) was free.
- `/opt/deployfleet` (the Odoo checkout) and `/opt/dogforce` were the
  only two directories under `/opt` — no naming collision with a new
  `/opt/deployfleet-whatsapp`.

**Decision made explicitly by Winston, not defaulted into**: skip
setting up a dedicated subdomain + TLS for this service (the original
plan). Reach it via the existing top-level domain or the bare IP,
directly on port `8787`, over plain HTTP. The disclosed cost of that
choice: the bearer secret this integration relies on
(`WHATSAPP_GATEWAY_SECRET`) travels in cleartext between Vercel and this
server on every request, in both directions. Acceptable for getting
connected and testing; worth revisiting (a reverse-proxy TLS block is a
small addition later, see the very end of this doc) before this carries
real production traffic.

---

## 1. Clone the repo, in its own directory

```bash
mkdir -p /opt/deployfleet-whatsapp
cd /opt/deployfleet-whatsapp
git clone https://github.com/creativesites/deployfleet-website.git .
cd whatsapp-service
```

## 2. `.env` — no editor needed

```bash
WA_SECRET=$(openssl rand -hex 32)
cat > .env <<EOF
PORT=8787
WHATSAPP_GATEWAY_SECRET=$WA_SECRET
DEPLOYFLEET_WEBHOOK_URL=https://deployfleet.vercel.app/api/whatsapp/webhook
LOG_LEVEL=silent
EOF
cat .env
```

Copy the `WHATSAPP_GATEWAY_SECRET` value from that output — you'll need
it once more in step 4, from your own terminal, never retyped or
re-pasted anywhere else.

## 3. Compose file — publishes the port directly, no reverse proxy

```bash
cat > docker-compose.yml <<'EOF'
services:
  whatsapp-service:
    build: .
    container_name: deployfleet-whatsapp-service
    restart: unless-stopped
    env_file: .env
    ports:
      - "8787:8787"
    volumes:
      - wa-auth:/app/.wa-auth
    networks:
      - whatsapp-service-net
networks:
  whatsapp-service-net:
    name: deployfleet-whatsapp-net
volumes:
  wa-auth:
    name: deployfleet-whatsapp-auth
EOF
docker compose up -d --build
curl -s http://127.0.0.1:8787/health
```

**Real bug hit and fixed during the actual deploy, not a hypothetical**:
the first build attempt failed with `npm error ... spawn git ENOENT` —
at least one package in Baileys' own dependency tree resolves via a git
URL at install time, and the plain `node:20-slim` base image has no
`git` binary. Fixed in `Dockerfile` (both build and runtime stages now
`apt-get install -y git ca-certificates` before `npm install`) — already
in the version you cloned in step 1 if you're reading this after that
fix landed; if your clone predates it, `git pull` before rebuilding.

If port `8787` isn't reachable from outside the server after this step,
check the host firewall:

```bash
# RHEL/Rocky-style (firewalld):
firewall-cmd --list-ports
firewall-cmd --add-port=8787/tcp --permanent && firewall-cmd --reload
```

## 4. Point Vercel at it

In the Vercel dashboard (Settings → Environment Variables, on the
`deployfleet-website` project):

```
WHATSAPP_GATEWAY_URL=http://<domain-or-IP>:8787
WHATSAPP_GATEWAY_SECRET=<the value from step 2's cat .env>
```

`<domain-or-IP>` is either `dogforcesecurityservices.com` or
`199.192.23.46` — both resolve to this box; either works identically
since there's no TLS/domain-specific routing involved at this port.
**Use `http://`, not `https://`** — nothing terminates TLS on 8787.
Redeploy the Vercel project after setting these (env var changes need a
redeploy to take effect).

Confirm from outside the server once redeployed:

```bash
curl -s http://<domain-or-IP>:8787/health
# {"ok":true}
```

## 5. Connect a real WhatsApp number

Pairing code (recommended — no screen needed on the server):

```bash
curl -X POST http://127.0.0.1:8787/connect \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "260XXXXXXXXX"}'

curl -s http://127.0.0.1:8787/status \
  -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>"
# poll until "linkCode" is set, e.g. "ABCD-1234"
```

On the phone with that number: WhatsApp → Settings → Linked Devices →
Link a Device → "Link with phone number instead" → enter the code.
Confirm once connected:

```bash
curl -s http://127.0.0.1:8787/status -H "Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>"
# {"connected":true,"phoneNumber":"260XXXXXXXXX","status":"connected",...}
```

## 6. End-to-end test

1. In the DeployFleet admin dashboard, open a real prospect's page and
   click **Verify number**.
2. Send that prospect a real WhatsApp message from the same page or
   from `/admin/whatsapp`.
3. Reply from the prospect's actual phone — it should appear in
   `/admin/whatsapp` within a few seconds.

---

## Operating it afterward

```bash
cd /opt/deployfleet-whatsapp/whatsapp-service
docker compose logs -f
docker compose restart
docker compose down && docker compose up -d --build   # after a git pull
```

A container restart (or a redeploy) resumes the saved WhatsApp session
automatically — `sessionManager.restoreIfSaved()` runs once on process
boot and reconnects using the credentials in the `wa-auth` volume, no
manual `/connect` needed unless it was actually logged out (check
`docker compose logs` for `[whatsapp-service] saved session found —
auto-restoring...`).

## Adding TLS later, if this needs to carry real traffic

The existing nginx + certbot setup on this box (already used for
`dogforcesecurityservices.com`) generalizes cleanly whenever it's worth
doing: add a subdomain A record, get a certbot cert for it the same way
the existing `dogforce.conf` does, and drop in one more `server {}`
block in its own `/etc/nginx/conf.d/deployfleet-whatsapp.conf` file with
`proxy_pass http://127.0.0.1:8787;` — then switch the Compose file's
port binding back to `127.0.0.1:8787:8787` (localhost-only) since nginx
becomes the only thing that needs to reach it directly, and update
`WHATSAPP_GATEWAY_URL` to the new `https://` subdomain. Nothing about
the service itself needs to change for this — it was written to sit
behind a reverse proxy just as easily as to be exposed directly.
