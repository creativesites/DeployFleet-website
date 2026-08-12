import { EventEmitter } from "events";

/**
 * Ported near-verbatim from Zuri (creativesites/Personal-Assistant,
 * services/whatsapp/src/transport/types.ts) per
 * docs/whatsapp-intelligence-architecture.md §4's "port near-verbatim"
 * call. Trimmed to what WA-0 actually needs (no catalog/status-post/
 * document-send/media methods — DeployFleet is text-only, no product
 * catalog, no proactive status-posting) and given one genuinely new
 * method neither Zuri nor Baileys' own higher-level API has ever
 * exposed as a first-class transport capability: checkAvailability()
 * (§6/§4's "build new" call).
 *
 * **The connection lifecycle itself — QR, pairing code, reconnect,
 * disconnect-reason handling — is the one piece of this port done
 * exactly like Zuri's, not simplified.** Per explicit user direction:
 * that logic took real, hard-won iteration in the donor product to get
 * working reliably, so baileys.ts below mirrors it closely rather than
 * re-deriving a "simpler" version that would have to re-learn the same
 * lessons (stale-socket event handling after a reconnect, credential
 * write races, QR-scan timeouts, pairing-code retry/formatting, and
 * which Baileys disconnect codes are terminal vs. retryable) from
 * scratch.
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
 *   'link_code'    (code: string)                        — phone-number pairing code ready to display (alternative to QR)
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

  /**
   * Request a phone-number pairing code (alternative to scanning a QR).
   * phoneNumber must be digits only, no +, e.g. "260979046745". Returns
   * the (already-hyphenated, e.g. "ABCD-1234") code to enter in WhatsApp
   * → Linked Devices. Zuri's own donor implementation only supports this
   * as a boot-time option (pass the phone to start()) — see baileys.ts.
   */
  abstract requestLinkCode(phoneNumber: string): Promise<string>;

  abstract getStatus(): TransportStatus;
  abstract getPhoneNumber(): string | null;

  protected emitQr(dataUrl: string): void {
    this.emit("qr", dataUrl);
  }
  protected emitLinkCode(code: string): void {
    this.emit("link_code", code);
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
