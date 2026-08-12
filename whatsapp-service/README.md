# DeployFleet WhatsApp Communication Layer (WA-0)

The gateway service designed in [`../docs/whatsapp-intelligence-architecture.md`](../docs/whatsapp-intelligence-architecture.md)
(§3, §13, §14 WA-0) — ported and adapted from Zuri
(`creativesites/Personal-Assistant`)'s own `services/whatsapp`, simplified
to a single WhatsApp session instead of Zuri's multi-tenant one.

**This is a separate service from the DeployFleet Next.js app on
purpose.** Baileys (the WhatsApp Web protocol library this service uses)
holds a persistent WebSocket connection and needs local disk for session
credentials — both fundamentally incompatible with Vercel's stateless,
time-limited serverless functions. This has to run as its own always-on
process, the same reason Zuri itself runs `services/whatsapp` separately
from `apps/web`.

## What this is not

It is not deployed anywhere. It has never connected to a real WhatsApp
account. Building it in this session was code-only, verified by
`npm run typecheck`/`npm run build` against real `@whiskeysockets/baileys`
types — never by an actual QR scan, since the development environment
this was built in has no phone to scan one with and no hosting-provider
credentials to deploy it. Both of the steps below are genuinely manual
work for Winston, not something any amount of further code can complete
from inside this repo.

## One-time setup (manual, external to this repo)

1. **Get a dedicated WhatsApp Business number** — per the architecture
   doc's §15 resolved recommendation, use a number separate from
   Winston's personal WhatsApp and separate from any Zuri-connected
   number, so a ban/restriction risk on this automation never touches
   either of those. A real business SIM or a WhatsApp Business API
   provider's own number both work — Baileys talks to WhatsApp's
   ordinary "linked device" protocol either way.
2. **Deploy this service somewhere always-on.** Railway is the concrete
   recommendation (§13/§15) — simplest Docker-based deploy, a persistent
   volume for `.wa-auth`, no cold starts. Fly.io or a small VPS work
   identically; this image has zero Railway-specific code. Point the
   volume at `/app/.wa-auth` (see `Dockerfile`) — losing that directory
   between deploys means scanning a new QR code.
3. **Set the two required env vars** (see `.env.example`):
   `WHATSAPP_GATEWAY_SECRET` (generate once, e.g. `openssl rand -hex 32`,
   and set the *same* value in the main app's `WHATSAPP_GATEWAY_URL`/
   `WHATSAPP_GATEWAY_SECRET` env vars) and `DEPLOYFLEET_WEBHOOK_URL`
   (the deployed Next.js app's `/api/whatsapp/webhook` URL).
4. **Connect the session**: `POST /connect` (with the bearer secret),
   then poll `GET /status` until `qrDataUrl` is set, and scan it from
   WhatsApp → Linked Devices on the number from step 1. There's no admin
   UI for this yet in `deployfleet_ui`/the Next.js app — a follow-up,
   not built in this session, since there's nothing to click-test it
   against without a live gateway anyway.
5. In the main app, set `WHATSAPP_GATEWAY_URL` to this service's public
   URL and `WHATSAPP_GATEWAY_SECRET` to the same secret from step 3.
   Every DeployFleet-side WhatsApp feature (verify/send/inbound
   analysis) degrades gracefully — "gateway not configured" — until both
   are set, the same pattern `isEmailJsConfigured()` already established
   for EmailJS.

## Local development

```bash
npm install
cp .env.example .env   # fill in the two required vars
npm run dev            # tsx watch — restarts on file change
```

## API surface

All routes except `GET /health` require `Authorization: Bearer <WHATSAPP_GATEWAY_SECRET>`.

| Route | Purpose |
|---|---|
| `GET /health` | Unauthenticated liveness check |
| `GET /status` | `{ connected, phoneNumber, status, qrDataUrl }` |
| `POST /connect` | Starts the session (generates a QR if not already linked) |
| `POST /disconnect` | Logs out and clears the in-memory session |
| `POST /messages/send` | `{ jid, text }` → `{ waMessageId }` |
| `POST /whatsapp/check` | `{ phone }` → `{ exists, jid }` — Baileys' `onWhatsApp()`, on-demand only (§15) |

Inbound messages are pushed out, not pulled: every message Baileys
receives is forwarded to `DEPLOYFLEET_WEBHOOK_URL` (`src/webhook.ts`),
authenticated the same way, matching the shape
`src/app/api/whatsapp/webhook/route.ts` on the DeployFleet side expects.
