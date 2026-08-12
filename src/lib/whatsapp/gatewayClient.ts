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
      return { ok: false, reason: `http_${response.status}` };
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
}

/** §14 WA-0's connect/QR/status admin surface — whether a real WhatsApp session is live right now. */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  const result = await gatewayFetch<GatewayStatus>("/status");
  if (!result.ok) return { connected: false, phoneNumber: null, status: "idle" };
  return result.data;
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
