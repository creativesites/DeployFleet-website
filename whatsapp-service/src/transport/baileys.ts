import path from "path";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import { WhatsAppTransport, type CheckAvailabilityResult, type TransportDisconnectReason, type TransportStatus } from "./types.js";

/**
 * Ported and simplified from Zuri (services/whatsapp/src/transport/baileys.ts,
 * 795 lines) per docs/whatsapp-intelligence-architecture.md §4: connection/
 * reconnect/QR/message-normalization logic is kept; the multi-tenant
 * `Map<userId, session>` plumbing, media download/upload, group-chat
 * handling, catalog methods, and historical-sync batching are all
 * stripped — WA-0 is single-session (one DeployFleet outreach number)
 * and text-only, matching the scope this document actually asks for.
 *
 * **Not live-verified** (architecture doc §15) — this dev environment
 * has no phone to scan a QR code with. Verified by `tsc`/`npm run build`
 * against real @whiskeysockets/baileys types only.
 */

const RECONNECT_BASE_MS = 3_000;
const RECONNECT_MAX_MS = 60_000;

const logger = pino({ level: process.env.LOG_LEVEL ?? "silent" });

export class BaileysTransport extends WhatsAppTransport {
  private sock: WASocket | null = null;
  private status: TransportStatus = "idle";
  private phoneNumber: string | null = null;
  private reconnectAttempts = 0;
  private readonly authDir: string;

  constructor(authDir = path.resolve(process.cwd(), ".wa-auth")) {
    super();
    this.authDir = authDir;
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  getPhoneNumber(): string | null {
    return this.phoneNumber;
  }

  async start(): Promise<void> {
    this.status = "connecting";
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      syncFullHistory: false,
    });

    this.sock.ev.on("creds.update", saveCreds);
    this.sock.ev.on("connection.update", (update) => this.handleConnectionUpdate(update));
    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        const jid = m.key.remoteJid;
        if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue; // §4 — group chats out of scope
        const body = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? null;
        const waMessageId = m.key.id;
        if (!waMessageId) continue;
        this.emitMessage({
          waMessageId,
          jid,
          fromMe: Boolean(m.key.fromMe),
          body,
          timestampMs: typeof m.messageTimestamp === "number" ? m.messageTimestamp * 1000 : Date.now(),
        });
      }
    });
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr);
      this.emitQr(dataUrl);
    }

    if (connection === "open") {
      this.status = "connected";
      this.reconnectAttempts = 0;
      this.phoneNumber = this.sock?.user?.id?.split(":")[0] ?? null;
      if (this.phoneNumber) this.emitConnected(this.phoneNumber);
    }

    if (connection === "close") {
      this.status = "idle";
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const reason = this.classifyDisconnect(statusCode);

      if (reason === "logged_out" || reason === "replaced") {
        this.emitDisconnected(reason);
        return;
      }

      this.emitDisconnected(reason);
      this.scheduleReconnect();
    }
  }

  private classifyDisconnect(statusCode: number | undefined): TransportDisconnectReason {
    switch (statusCode) {
      case DisconnectReason.loggedOut:
        return "logged_out";
      case DisconnectReason.badSession:
        return "bad_session";
      case DisconnectReason.connectionReplaced:
        return "replaced";
      case DisconnectReason.timedOut:
        return "timeout";
      case undefined:
        return "unknown";
      default:
        return "network";
    }
  }

  /** §2.2 — the exact reconnect-backoff shape Zuri's own BaileysTransport uses: 3s base, 60s cap, uncapped attempts. */
  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1), RECONNECT_MAX_MS);
    setTimeout(() => {
      this.start().catch((err) => logger.error({ err }, "reconnect failed"));
    }, delay);
  }

  async stop(): Promise<void> {
    await this.sock?.logout().catch(() => undefined);
    this.sock = null;
    this.status = "idle";
    this.phoneNumber = null;
  }

  async sendText(jid: string, text: string): Promise<string> {
    if (!this.sock || this.status !== "connected") throw new Error("not_connected");
    const result = await this.sock.sendMessage(jid, { text });
    const id = result?.key?.id;
    if (!id) throw new Error("send_failed");
    return id;
  }

  /** §6 — Baileys' own onWhatsApp() primitive, wired up here for the first time in either DeployFleet or Zuri. */
  async checkAvailability(phone: string): Promise<CheckAvailabilityResult> {
    if (!this.sock || this.status !== "connected") throw new Error("not_connected");
    const digits = phone.replace(/[^0-9]/g, "");
    const results = await this.sock.onWhatsApp(digits);
    const match = results?.[0];
    return { exists: Boolean(match?.exists), jid: match?.exists ? (match.jid ?? null) : null };
  }
}
