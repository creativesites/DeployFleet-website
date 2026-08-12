import { BaileysTransport } from "./transport/baileys.js";
import type { CheckAvailabilityResult, TransportStatus } from "./transport/types.js";
import { forwardMessageToDeployFleet } from "./webhook.js";

/**
 * Ported and radically simplified from Zuri's SessionManager
 * (services/whatsapp/src/lib/session-manager.ts, 779 lines) per
 * docs/whatsapp-intelligence-architecture.md §4/§14 WA-0: this build is
 * single-session (Winston's one DeployFleet outreach number), so the
 * `Map<userId, session>` lifecycle, QR TTL bookkeeping, and the
 * reconciliation-on-reconnect job are all dropped — there's only ever
 * one session, and BaileysTransport's own reconnect backoff (ported
 * separately) already covers "missed messages during a disconnect
 * window" for the single-session case by resubscribing to live events
 * the moment the socket reconnects.
 */
export class SessionManager {
  private transport: BaileysTransport | null = null;
  private lastQrDataUrl: string | null = null;

  async connect(): Promise<void> {
    if (this.transport && this.transport.getStatus() !== "idle") return;

    const transport = new BaileysTransport();
    transport.on("qr", (dataUrl: string) => {
      this.lastQrDataUrl = dataUrl;
    });
    transport.on("connected", () => {
      this.lastQrDataUrl = null;
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
  }

  getStatus(): { connected: boolean; phoneNumber: string | null; status: TransportStatus; qrDataUrl: string | null } {
    const status = this.transport?.getStatus() ?? "idle";
    return {
      connected: status === "connected",
      phoneNumber: this.transport?.getPhoneNumber() ?? null,
      status,
      qrDataUrl: this.lastQrDataUrl,
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
}

export const sessionManager = new SessionManager();
