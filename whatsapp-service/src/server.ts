import express, { type NextFunction, type Request, type Response } from "express";
import { sessionManager } from "./sessionManager.js";

/**
 * §14 WA-0's own abstraction surface, as an HTTP API DeployFleet's
 * Next.js app calls via src/lib/whatsapp/gatewayClient.ts: status /
 * connect / messages.send / whatsapp.check. Every route (except the
 * unauthenticated health check) requires the same bearer secret
 * gatewayClient.ts sends — this is the one shared secret the whole
 * integration hinges on, set identically on both sides
 * (WHATSAPP_GATEWAY_SECRET).
 */

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET;
  if (!secret) {
    res.status(500).json({ ok: false, reason: "gateway_secret_not_configured" });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, reason: "unauthorized" });
    return;
  }
  next();
}

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(requireAuth);

  app.get("/status", (_req, res) => {
    const status = sessionManager.getStatus();
    res.json(status);
  });

  /** §14 WA-0's "connect / QR" admin surface — starts a session and returns the QR data URL once one is generated (poll GET /status for it if this returns before the QR event fires). */
  app.post("/connect", async (_req, res) => {
    try {
      await sessionManager.connect();
      res.json({ ok: true, status: sessionManager.getStatus() });
    } catch (err) {
      res.status(500).json({ ok: false, reason: err instanceof Error ? err.message : "connect_failed" });
    }
  });

  app.post("/disconnect", async (_req, res) => {
    await sessionManager.disconnect();
    res.json({ ok: true });
  });

  app.post("/messages/send", async (req, res) => {
    const { jid, text } = req.body as { jid?: string; text?: string };
    if (!jid || !text) {
      res.status(400).json({ ok: false, reason: "invalid_request" });
      return;
    }
    try {
      const waMessageId = await sessionManager.sendText(jid, text);
      res.json({ waMessageId });
    } catch (err) {
      res.status(503).json({ ok: false, reason: err instanceof Error ? err.message : "send_failed" });
    }
  });

  /** §6 — on-demand only, per docs/whatsapp-intelligence-architecture.md §15's resolved rate-limit-safety decision. Nothing in this service ever calls this route in a loop. */
  app.post("/whatsapp/check", async (req, res) => {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ ok: false, reason: "invalid_request" });
      return;
    }
    try {
      const result = await sessionManager.checkAvailability(phone);
      res.json(result);
    } catch (err) {
      res.status(503).json({ ok: false, reason: err instanceof Error ? err.message : "check_failed" });
    }
  });

  return app;
}
