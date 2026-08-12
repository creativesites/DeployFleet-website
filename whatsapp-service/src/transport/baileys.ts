import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import P from "pino";
import * as fs from "fs/promises";
import * as path from "path";
import { WhatsAppTransport, type CheckAvailabilityResult, type NormalisedMessage, type TransportStatus } from "./types.js";

/**
 * **Ported from Zuri's `services/whatsapp/src/transport/baileys.ts`
 * as close to verbatim as this build's single-session, text-only scope
 * allows** — per explicit user direction that this exact connection
 * lifecycle (not a "simplified" reinvention of it) is what should ship,
 * since getting it right in the donor product took real, repeated
 * iteration. What's dropped is genuinely orthogonal to *connecting*:
 * multi-tenant `userId` keying (this service is single-session, per
 * WA-0's own already-agreed scope), media download/upload, location/
 * contact-card/catalog/status-post handling (DeployFleet doesn't need
 * any of those). Every piece of the connection/QR/pairing/reconnect
 * logic below — the exact `makeWASocket` config, the stale-socket
 * guard, the credential write queue, the QR-scan timeout, the
 * pairing-code retry-and-format logic, and the exact per-disconnect-
 * code handling — is the same shape as the donor implementation.
 *
 * **Not live-verified** (architecture doc §15) — this dev environment
 * has no phone to scan a QR code or enter a pairing code with. Verified
 * by `tsc`/`npm run build` against real `@whiskeysockets/baileys` types
 * only.
 */

const QR_TIMEOUT_MS = 3 * 60 * 1000;
const RECONNECT_BASE_MS = 3_000;
const RECONNECT_MAX_MS = 60_000; // cap at 60s — keeps trying forever, same as Zuri

/** Serializes `creds.update` writes to the auth-state files — without this, two overlapping writes can interleave and corrupt the credential file, a real failure mode Baileys itself doesn't guard against. */
class WriteQueue {
  private promise: Promise<void> = Promise.resolve();

  enqueue(fn: () => Promise<void> | void): Promise<void> {
    const next = this.promise.then(async () => {
      try {
        await fn();
      } catch (err) {
        console.error("[write-queue] write failed:", err);
      }
    });
    this.promise = next;
    return next;
  }

  async wait(): Promise<void> {
    await this.promise;
  }
}

export class BaileysTransport extends WhatsAppTransport {
  private sock: WASocket | null = null;
  private _status: TransportStatus = "idle";
  private _stopping = false;
  private _reconnectCount = 0;
  private _badSessionCount = 0;
  private readonly writeQueue = new WriteQueue();
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _qrTimer: ReturnType<typeof setTimeout> | null = null;
  private _phoneNumber: string | null = null;
  private readonly authPath: string;
  private static cachedVersion: [number, number, number] | null = null;

  /**
   * `pairingPhone` mirrors Zuri's own constructor shape: pass a phone
   * number to boot straight into pairing-code mode (no QR at all);
   * leave it undefined for the QR flow. `forceNewQR` purges any saved
   * auth state before connecting — Zuri's own "start fresh" switch.
   */
  constructor(
    authDir = path.resolve(process.cwd(), ".wa-auth"),
    private readonly pairingPhone?: string,
    private readonly forceNewQR = false
  ) {
    super();
    this.authPath = authDir;
  }

  getStatus(): TransportStatus {
    return this._status;
  }

  getPhoneNumber(): string | null {
    return this._phoneNumber;
  }

  async start(): Promise<void> {
    this._stopping = false;
    this._status = "connecting";
    // Clear stale auth once at session start — not on every internal
    // reconnect. forceNewQR: user-triggered fresh connect. pairingPhone:
    // creds.registered would otherwise block requestPairingCode.
    if (this.forceNewQR || this.pairingPhone) {
      await fs.rm(this.authPath, { recursive: true, force: true }).catch(() => undefined);
    }
    await this._boot();
  }

  private async getBaileysVersion(): Promise<[number, number, number]> {
    if (BaileysTransport.cachedVersion) return BaileysTransport.cachedVersion;
    try {
      const result = await fetchLatestBaileysVersion();
      BaileysTransport.cachedVersion = result.version as [number, number, number];
      return BaileysTransport.cachedVersion;
    } catch (err) {
      console.warn("[baileys] failed to fetch latest version, using fallback:", err);
      return [2, 3000, 1015920080];
    }
  }

  async stop(): Promise<void> {
    this._stopping = true;
    this._clearQrTimer();
    this._clearReconnectTimer();
    await this.writeQueue.wait();
    if (this.sock) {
      try {
        this.sock.ws.close();
      } catch {
        /* ignore */
      }
      this.sock = null;
    }
    this._status = "idle";
    this._phoneNumber = null;
  }

  async sendText(jid: string, text: string): Promise<string> {
    if (!this.sock) throw new Error("not_connected");
    const result = await this.sock.sendMessage(jid, { text });
    const id = result?.key?.id;
    if (!id) throw new Error("send_failed");
    return id;
  }

  /** §6 — Baileys' own onWhatsApp() primitive, wired up here for the first time in either DeployFleet or Zuri. */
  async checkAvailability(phone: string): Promise<CheckAvailabilityResult> {
    if (!this.sock) throw new Error("not_connected");
    const digits = phone.replace(/[^0-9]/g, "");
    const results = await this.sock.onWhatsApp(digits);
    const match = results?.[0];
    return { exists: Boolean(match?.exists), jid: match?.exists ? (match.jid ?? null) : null };
  }

  async requestLinkCode(phoneNumber: string): Promise<string> {
    if (!this.sock) throw new Error("not_connected");
    return this.requestPairingCodeWithRetry(phoneNumber);
  }

  /** Ported verbatim from Zuri: 3 attempts, exponential backoff between them, and the exact XXXX-XXXX code formatting WhatsApp's own pairing UI expects. */
  private async requestPairingCodeWithRetry(phone: string, maxAttempts = 3): Promise<string> {
    const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    console.log(`[baileys] requesting pairing code for number: ${digits} (${digits.length} digits)`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!this.sock) throw new Error("socket_not_ready");
        const rawCode = await this.sock.requestPairingCode(digits);
        let code = rawCode;
        if (code) {
          const clean = code.replace(/[^A-Za-z0-9]/g, "");
          if (clean.length === 8) code = `${clean.slice(0, 4)}-${clean.slice(4)}`;
        }
        console.log(`[baileys] pairing code generated: ${code} (attempt ${attempt})`);
        this.emitLinkCode(code);
        return code;
      } catch (err) {
        console.error(`[baileys] requestPairingCode failed (attempt ${attempt}, number: ${digits}):`, err);
        if (attempt === maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    throw new Error("pairing_code_failed");
  }

  private async _boot(): Promise<void> {
    const version = await this.getBaileysVersion();

    if (this.forceNewQR || this.pairingPhone) {
      try {
        const { state: existingState } = await useMultiFileAuthState(this.authPath);
        if (!existingState.creds.registered) {
          console.log(`[baileys] purging unregistered auth directory before fresh connect: ${this.authPath}`);
          await fs.rm(this.authPath, { recursive: true, force: true }).catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: process.env.LOG_LEVEL ?? "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: true,
    });

    this.sock = sock;

    // Queue credential updates to prevent write race conditions.
    sock.ev.on("creds.update", () => {
      if (sock !== this.sock) return; // stale-socket guard — see class doc comment
      this.writeQueue.enqueue(saveCreds);
    });

    // Phone-code pairing: call requestPairingCode with retry after a
    // 3-second handshake delay, exactly as Zuri does — requesting it
    // before the WebSocket handshake settles reliably fails.
    if (this.pairingPhone) {
      setTimeout(async () => {
        try {
          if (sock !== this.sock) return;
          await this.requestPairingCodeWithRetry(this.pairingPhone!);
        } catch (err) {
          console.error("[baileys] pairing code retry exhausted:", err);
          this.emitDisconnected("bad_session");
        }
      }, 3000);
    }

    sock.ev.on("connection.update", async (update) => {
      if (sock !== this.sock) return; // a previous, already-replaced socket's late event

      const { connection, lastDisconnect, qr } = update;

      if (qr && !this.pairingPhone) {
        this._resetQrTimer();
        try {
          const dataUrl = await QRCode.toDataURL(qr);
          this.emitQr(dataUrl);
        } catch (err) {
          console.error("[baileys] QR encode error:", err);
        }
      }

      if (connection === "open") {
        this._clearQrTimer();
        this._clearReconnectTimer();
        this._reconnectCount = 0;
        this._badSessionCount = 0;
        this._status = "connected";
        const raw = sock.user?.id ?? "";
        this._phoneNumber = raw.split(":")[0].split("@")[0] || null;
        if (this._phoneNumber) this.emitConnected(this._phoneNumber);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          this._clearQrTimer();
          this._status = "idle";
          await fs.rm(this.authPath, { recursive: true, force: true }).catch(() => undefined);
          this.emitDisconnected("logged_out");
          return;
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          this._clearQrTimer();
          this._clearReconnectTimer();
          this._status = "idle";
          console.log("[baileys] connection replaced by another client — stopping reconnect");
          this.emitDisconnected("replaced");
          return;
        }

        if (statusCode === DisconnectReason.restartRequired) {
          console.log("[baileys] server requested restart — reconnecting immediately");
          this._reconnectTimer = setTimeout(() => {
            if (!this._stopping) this._boot().catch((err) => console.error("[baileys] restart-required reboot failed:", err));
          }, 500);
          return;
        }

        if (statusCode === DisconnectReason.badSession) {
          this._badSessionCount++;
          console.warn(`[baileys] bad_session received (attempt ${this._badSessionCount}/3)`);
          if (this._badSessionCount > 3) {
            this._clearQrTimer();
            this._status = "idle";
            await fs.rm(this.authPath, { recursive: true, force: true }).catch(() => undefined);
            this.emitDisconnected("bad_session");
            return;
          }
          // Fall through to reconnect as a network drop — a bad_session
          // is often transient and worth a few retries before giving up.
        }

        if (this._stopping) return;

        // Network / transient drop — retry with exponential backoff, no cap on attempts.
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** this._reconnectCount, RECONNECT_MAX_MS);
        this._reconnectCount++;
        this._status = "connecting";
        console.log(`[baileys] network drop (status ${statusCode}) — reconnecting in ${Math.round(delay / 1000)}s (attempt ${this._reconnectCount})`);
        this._reconnectTimer = setTimeout(() => {
          if (!this._stopping) this._boot().catch((err) => console.error("[baileys] reconnect failed:", err));
        }, delay);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (sock !== this.sock) return;
      if (type !== "notify") return;
      for (const msg of messages) {
        try {
          const normalised = this._normalise(msg);
          if (normalised) this.emitMessage(normalised);
        } catch (err) {
          console.error("[baileys] normalise error:", err);
        }
      }
    });

    // Baileys delivers historical chats/messages on first connect
    // (syncFullHistory: true, matching Zuri exactly) — unlike Zuri,
    // DeployFleet doesn't consume this batch (no bulk-history-import
    // feature exists here, per WA-2's own scope), so it's intentionally
    // left unhandled rather than partially wired up.
  }

  /** Trimmed from Zuri's own `_normalise()`: text messages only — DeployFleet has no media/location/contact-card/catalog handling to normalise into. */
  private _normalise(msg: WAMessage): NormalisedMessage | null {
    const jid = msg.key.remoteJid;
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return null; // group chats/status out of scope

    const content = msg.message;
    if (!content) return null;
    if (content.protocolMessage || content.senderKeyDistributionMessage || content.reactionMessage) return null;

    const textBody = content.conversation ?? content.extendedTextMessage?.text ?? null;
    if (textBody === null) return null; // non-text message — out of scope for this build

    const waMessageId = msg.key.id;
    if (!waMessageId) return null;

    return {
      waMessageId,
      jid,
      fromMe: Boolean(msg.key.fromMe),
      body: textBody,
      timestampMs: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
    };
  }

  private _resetQrTimer(): void {
    this._clearQrTimer();
    this._qrTimer = setTimeout(async () => {
      console.log(`[baileys] QR timeout — no scan after ${QR_TIMEOUT_MS / 1000}s`);
      await this.stop();
      this.emitDisconnected("timeout");
    }, QR_TIMEOUT_MS);
  }

  private _clearQrTimer(): void {
    if (this._qrTimer) {
      clearTimeout(this._qrTimer);
      this._qrTimer = null;
    }
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}
