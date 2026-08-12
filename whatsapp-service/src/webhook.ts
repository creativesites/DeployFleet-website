import type { NormalisedMessage } from "./transport/types.js";

/**
 * §14 WA-0/WA-2 — every inbound message gets forwarded here, to
 * DeployFleet's own POST /api/whatsapp/webhook (src/app/api/whatsapp/webhook/route.ts),
 * authenticated with the same shared secret gatewayClient.ts uses in the
 * other direction. This is the only place this service talks back to
 * DeployFleet — it never writes to Firestore itself, keeping this
 * service's own footprint to "talks to WhatsApp, talks to one webhook,"
 * nothing else.
 */
export async function forwardMessageToDeployFleet(msg: NormalisedMessage): Promise<void> {
  const url = process.env.DEPLOYFLEET_WEBHOOK_URL;
  const secret = process.env.WHATSAPP_GATEWAY_SECRET;
  if (!url || !secret) {
    console.warn("[whatsapp-service] DEPLOYFLEET_WEBHOOK_URL/WHATSAPP_GATEWAY_SECRET not set — inbound message not forwarded");
    return;
  }

  const phone = msg.jid.split("@")[0];
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      jid: msg.jid,
      phone,
      waMessageId: msg.waMessageId,
      body: msg.body,
      timestampMs: msg.timestampMs,
      fromMe: msg.fromMe,
    }),
  });

  if (!response.ok) {
    console.error(`[whatsapp-service] webhook forward returned ${response.status}`);
  }
}
