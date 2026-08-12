import { EventEmitter } from "events";

/**
 * Ported near-verbatim from Zuri (creativesites/Personal-Assistant,
 * services/whatsapp/src/transport/types.ts) per
 * docs/whatsapp-intelligence-architecture.md §4's "port near-verbatim"
 * call — this abstraction boundary is already exactly right and no
 * DeployFleet-specific concept leaks into it. Trimmed to what WA-0
 * actually needs (no catalog/status-post/document-send methods, since
 * this build has no product catalog and no proactive status-posting
 * feature) and given one genuinely new method neither Zuri nor Baileys'
 * own higher-level API has ever exposed as a first-class transport
 * capability: checkAvailability() — see §6/§4's "build new" call.
 */

export interface NormalisedMessage {
  waMessageId: string;
  /** The conversation JID — e.g. "260979046745@s.whatsapp.net" */
  jid: string;
  fromMe: boolean;
  body: string | null;
  timestampMs: number;
}

export type TransportDisconnectReason = "logged_out" | "bad_session" | "timeout" | "network" | "replaced" | "unknown";

export type TransportStatus = "idle" | "connecting" | "connected";

export interface CheckAvailabilityResult {
  exists: boolean;
  jid: string | null;
}

/**
 * Contract every WhatsApp transport adapter must fulfil. The rest of
 * this service only ever talks to this interface — never to Baileys
 * directly — the same discipline Zuri's own SessionManager follows.
 *
 * Events emitted:
 *   'qr'           (dataUrl: string)                    — QR code ready to display
 *   'connected'    (phoneNumber: string)                — session is live
 *   'disconnected' (reason: TransportDisconnectReason)  — session ended (terminal)
 *   'message'      (msg: NormalisedMessage)              — inbound message
 */
export abstract class WhatsAppTransport extends EventEmitter {
  /** Start the session (generate QR or restore from saved credentials). */
  abstract start(): Promise<void>;

  /** Cleanly shut down the session. */
  abstract stop(): Promise<void>;

  /** Send a text message to a JID; returns the WhatsApp message id. */
  abstract sendText(jid: string, text: string): Promise<string>;

  /**
   * §6 — the genuinely new capability. Baileys the library exposes
   * sock.onWhatsApp() as a primitive; this method is the first time
   * either DeployFleet or Zuri has wired it up as a first-class,
   * always-callable transport method.
   */
  abstract checkAvailability(phone: string): Promise<CheckAvailabilityResult>;

  abstract getStatus(): TransportStatus;
  abstract getPhoneNumber(): string | null;

  protected emitQr(dataUrl: string): void {
    this.emit("qr", dataUrl);
  }
  protected emitConnected(phoneNumber: string): void {
    this.emit("connected", phoneNumber);
  }
  protected emitDisconnected(reason: TransportDisconnectReason): void {
    this.emit("disconnected", reason);
  }
  protected emitMessage(msg: NormalisedMessage): void {
    this.emit("message", msg);
  }
}
