import "server-only";

/**
 * WA-0's abstraction surface, as designed in
 * docs/whatsapp-intelligence-architecture.md §3/§14: DeployFleet's
 * Next.js app never talks to Baileys directly (it can't — see §13's
 * hard hosting constraint). It talks to this thin HTTP client, which
 * calls the separately-deployed `whatsapp-service` gateway (WA-0).
 *
 * Same graceful-degradation discipline as isEmailJsConfigured(): every
 * function here checks isGatewayConfigured() / a live /status response
 * first and returns a typed "not connected" result rather than throwing,
 * since — per this session's own honest disclosure (architecture doc
 * §15) — no gateway is actually deployed anywhere reachable from this
 * dev environment. Every call path above this client (verify/send
 * routes, Orchestrator tools) is written to behave correctly whether or
 * not a real gateway is live.
 */

const TIMEOUT_MS = 15_000;

export function isGatewayConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_GATEWAY_URL && process.env.WHATSAPP_GATEWAY_SECRET);
}

function gatewayUrl(path: string): string {
  const base = (process.env.WHATSAPP_GATEWAY_URL ?? "").replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Real bug fixed here: on a non-2xx response this used to discard the
 * gateway's own JSON body (`{ ok: false, reason: "not_connected" }` etc.)
 * and synthesize a generic `http_503`, so every failure past "reachable"
 * collapsed into the same undiagnosable code. `/status` itself never
 * returns non-2xx (see below), so this specifically affects
 * checkAvailability()/sendText()/connectGateway() — exactly the calls
 * behind "Verify number isn't working."
 */
async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  if (!isGatewayConfigured()) {
    return { ok: false, reason: "gateway_not_configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(gatewayUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_GATEWAY_SECRET}`,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const bodyReason = body && typeof body === "object" && "reason" in body ? (body as { reason?: unknown }).reason : undefined;
      return { ok: false, reason: typeof bodyReason === "string" && bodyReason ? bodyReason : `http_${response.status}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { ok: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface GatewayStatus {
  connected: boolean;
  phoneNumber: string | null;
  status: "idle" | "connecting" | "connected";
  qrDataUrl: string | null;
  linkCode: string | null;
  /**
   * Set only when this status is a fallback because the gateway itself
   * couldn't be reached (network/timeout/auth/5xx) — distinct from the
   * gateway genuinely reporting `status: "idle"`. Without this,
   * "can't reach the gateway" and "gateway says disconnected" rendered
   * as the exact same "Connect WhatsApp" empty state, which is exactly
   * why the "still shows Connect" bug was undiagnosable from the UI
   * alone. See WhatsAppConnectPanel/SendWhatsAppPanel for how this
   * is surfaced.
   */
  unreachableReason?: string;
}

function idleStatus(unreachableReason?: string): GatewayStatus {
  return { connected: false, phoneNumber: null, status: "idle", qrDataUrl: null, linkCode: null, unreachableReason };
}

/** §14 WA-0's connect/QR/status admin surface — whether a real WhatsApp session is live right now. */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  const result = await gatewayFetch<GatewayStatus>("/status");
  if (!result.ok) return idleStatus(result.reason);
  return result.data;
}

export interface ConnectGatewayResult {
  ok: boolean;
  reason?: string;
  status?: GatewayStatus;
}

/**
 * The one function that actually starts a WhatsApp session — mirrors
 * the gateway's own `POST /connect` (§14 WA-0). Omit `phone` for the
 * QR flow, pass digits-only for the pairing-code flow instead. Called
 * from the admin dashboard's own "Connect WhatsApp" panel
 * (WhatsAppInboxTab.tsx) via POST /api/admin/crm/whatsapp/gateway/connect
 * — never automatically, always an explicit human click.
 */
export async function connectGateway(options: { phone?: string; forceNewQR?: boolean } = {}): Promise<ConnectGatewayResult> {
  const result = await gatewayFetch<{ ok: boolean; status: GatewayStatus }>("/connect", {
    method: "POST",
    body: JSON.stringify(options),
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, status: result.data.status };
}

export interface CheckAvailabilityResult {
  ok: boolean;
  reason?: string;
  exists?: boolean;
  jid?: string | null;
}

/**
 * §6 — Baileys' onWhatsApp() primitive, called on-demand only (§15's
 * resolved rate-limit-safety decision), never in a batch/background job.
 */
export async function checkAvailability(phone: string): Promise<CheckAvailabilityResult> {
  const result = await gatewayFetch<{ exists: boolean; jid: string | null }>("/whatsapp/check", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, exists: result.data.exists, jid: result.data.jid };
}

export interface GatewayHealthResult {
  reachable: boolean;
  reason?: string;
  latencyMs?: number;
}

/**
 * Hits the gateway's unauthenticated `/health` route directly — no
 * bearer secret involved, so this answers one narrow question cleanly:
 * "is the whatsapp-service process even up and network-reachable from
 * this Vercel deployment at all," independent of whether a WhatsApp
 * session is connected. Deliberately doesn't reuse gatewayFetch() (which
 * always sends the Authorization header) so a wrong/rotated secret can't
 * masquerade as "gateway unreachable" — those are different failure
 * modes and worth telling apart in the UI (WhatsAppConnectPanel's
 * diagnostics panel).
 */
export async function checkGatewayHealth(): Promise<GatewayHealthResult> {
  if (!isGatewayConfigured()) return { reachable: false, reason: "gateway_not_configured" };
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(gatewayUrl("/health"), { signal: controller.signal });
    const latencyMs = Date.now() - started;
    if (!response.ok) return { reachable: false, reason: `http_${response.status}`, latencyMs };
    return { reachable: true, latencyMs };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { reachable: false, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SendTextResult {
  ok: boolean;
  reason?: string;
  waMessageId?: string;
}

/** §5.4/§8 — always called from a route that has already run the cap/cooldown/opt-out/approval checks; this client itself enforces none of them. */
export async function sendText(jid: string, text: string): Promise<SendTextResult> {
  const result = await gatewayFetch<{ waMessageId: string }>("/messages/send", {
    method: "POST",
    body: JSON.stringify({ jid, text }),
  });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, waMessageId: result.data.waMessageId };
}
