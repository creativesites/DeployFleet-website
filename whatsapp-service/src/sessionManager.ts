import { BaileysTransport } from "./transport/baileys.js";
import type { CheckAvailabilityResult, TransportStatus } from "./transport/types.js";
import { forwardMessageToDeployFleet } from "./webhook.js";

/**
 * Simplified from Zuri's `SessionManager`
 * (services/whatsapp/src/lib/session-manager.ts) to single-session —
 * this build is one DeployFleet outreach number, not Zuri's
 * `Map<userId, session>` multi-tenant one, so the per-user bookkeeping
 * (Postgres `whatsapp_instances` rows, Redis pub/sub per userId, the
 * reconciliation-on-reconnect job) is dropped. **The connect/QR/
 * pairing-code lifecycle itself is not simplified** — see the comment
 * at the top of transport/baileys.ts: that logic is ported as closely
 * to the donor implementation as this single-session scope allows, per
 * explicit user direction that it's the part worth getting exactly
 * right rather than re-deriving.
 */
export class SessionManager {
  private transport: BaileysTransport | null = null;
  private lastQrDataUrl: string | null = null;
  private lastLinkCode: string | null = null;

  /**
   * Mirrors Zuri's own `startSession(userId, phoneNumber?, forceNewQR)`:
   * omit `phone` for the QR flow, pass it for the pairing-code flow
   * (no QR at all — WhatsApp → Linked Devices → "Link with phone number
   * instead"). `forceNewQR` purges any saved session and starts clean.
   */
  async connect(options: { phone?: string; forceNewQR?: boolean } = {}): Promise<void> {
    if (this.transport && this.transport.getStatus() !== "idle" && !options.forceNewQR && !options.phone) return;

    if (this.transport) {
      await this.transport.stop().catch(() => undefined);
    }

    this.lastQrDataUrl = null;
    this.lastLinkCode = null;

    const transport = new BaileysTransport(undefined, options.phone, options.forceNewQR ?? false);
    transport.on("qr", (dataUrl: string) => {
      this.lastQrDataUrl = dataUrl;
      this.lastLinkCode = null;
    });
    transport.on("link_code", (code: string) => {
      this.lastLinkCode = code;
      this.lastQrDataUrl = null;
    });
    transport.on("connected", () => {
      this.lastQrDataUrl = null;
      this.lastLinkCode = null;
    });
    transport.on("disconnected", (reason: string) => {
      console.log(`[whatsapp-service] disconnected: ${reason}`);
    });
    transport.on("message", (msg) => {
      forwardMessageToDeployFleet(msg).catch((err) => console.error("[whatsapp-service] webhook forward failed", err));
    });

    this.transport = transport;
    await transport.start();
  }

  async disconnect(): Promise<void> {
    await this.transport?.stop();
    this.transport = null;
    this.lastQrDataUrl = null;
    this.lastLinkCode = null;
  }

  getStatus(): {
    connected: boolean;
    phoneNumber: string | null;
    status: TransportStatus;
    qrDataUrl: string | null;
    linkCode: string | null;
  } {
    const status = this.transport?.getStatus() ?? "idle";
    return {
      connected: status === "connected",
      phoneNumber: this.transport?.getPhoneNumber() ?? null,
      status,
      qrDataUrl: this.lastQrDataUrl,
      linkCode: this.lastLinkCode,
    };
  }

  async sendText(jid: string, text: string): Promise<string> {
    if (!this.transport) throw new Error("not_connected");
    return this.transport.sendText(jid, text);
  }

  async checkAvailability(phone: string): Promise<CheckAvailabilityResult> {
    if (!this.transport) throw new Error("not_connected");
    return this.transport.checkAvailability(phone);
  }

  /** On-demand pairing code request against an already-connecting (QR-mode) socket — the alternative path to passing `phone` directly to connect(). */
  async requestLinkCode(phoneNumber: string): Promise<string> {
    if (!this.transport) throw new Error("not_connected");
    return this.transport.requestLinkCode(phoneNumber);
  }
}

export const sessionManager = new SessionManager();
