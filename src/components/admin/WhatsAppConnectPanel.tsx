"use client";

import { useEffect, useState } from "react";

interface GatewayStatus {
  connected: boolean;
  phoneNumber: string | null;
  status: "idle" | "connecting" | "connected";
  qrDataUrl: string | null;
  linkCode: string | null;
  unreachableReason?: string;
}

function describeUnreachable(reason: string): string {
  switch (reason) {
    case "timeout":
      return "The WhatsApp gateway didn't respond in time — it may be restarting or unreachable.";
    case "network_error":
      return "Couldn't reach the WhatsApp gateway server at all — check it's running and the port is open.";
    case "http_401":
    case "unauthorized":
      return "The gateway rejected our request — WHATSAPP_GATEWAY_SECRET doesn't match on both sides.";
    default:
      return `Couldn't reach the WhatsApp gateway (${reason}).`;
  }
}

interface StatusResponse {
  ok: boolean;
  configured: boolean;
  gateway: GatewayStatus;
  sentToday: number;
  cap: number;
}

const POLL_MS = 4_000;

/**
 * The admin dashboard's own "Connect WhatsApp" surface — the piece
 * `whatsapp-service/README.md` originally flagged as "no admin UI for
 * this yet," closed here. Mirrors the gateway's own two connect paths
 * (docs/whatsapp-intelligence-architecture.md §14 WA-0, ported from
 * Zuri's own donor connection flow): a phone-number pairing code
 * (recommended — no QR-scanning device needed) or a QR image. Polls
 * status the whole time it's open so the code/QR/connected state
 * updates live without a manual refresh.
 */
export default function WhatsAppConnectPanel({ onConnected }: { onConnected?: () => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"pairing" | "qr" | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function loadStatus() {
    fetch("/api/admin/crm/whatsapp/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: StatusResponse) => {
        setStatus(data);
        if (data.gateway?.connected) onConnected?.();
      });
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startPairing() {
    if (!phone.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/gateway/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.reason === "gateway_not_configured" ? "The gateway isn't configured yet." : "Couldn't start pairing.");
      else loadStatus();
    } catch {
      setError("Network error reaching the gateway.");
    } finally {
      setConnecting(false);
    }
  }

  async function startQr() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/gateway/connect", { method: "POST" });
      const data = await res.json();
      if (!data.ok) setError(data.reason === "gateway_not_configured" ? "The gateway isn't configured yet." : "Couldn't start the QR session.");
      else loadStatus();
    } catch {
      setError("Network error reaching the gateway.");
    } finally {
      setConnecting(false);
    }
  }

  if (!status) return null;
  if (!status.configured) {
    return (
      <div className="mb-4 rounded-df-md border border-border bg-canvas p-3 text-xs text-muted">
        WhatsApp gateway isn&apos;t configured — set <code>WHATSAPP_GATEWAY_URL</code>/<code>WHATSAPP_GATEWAY_SECRET</code> to enable it.
      </div>
    );
  }

  if (status.gateway.unreachableReason) {
    return (
      <div className="mb-4 rounded-df-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
        {describeUnreachable(status.gateway.unreachableReason)} This is different from &quot;not connected&quot; — the gateway may actually still
        be connected, we just can&apos;t confirm it from here right now. Retrying automatically.
      </div>
    );
  }

  if (status.gateway.connected) {
    return (
      <div className="mb-4 flex items-center justify-between gap-2 rounded-df-md border border-teal/30 bg-teal/10 px-3 py-2 text-xs">
        <span className="font-medium text-teal">WhatsApp connected — {status.gateway.phoneNumber}</span>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-muted hover:text-navy">
          {expanded ? "Hide" : "Reconnect with a different number"}
        </button>
        {expanded && (
          <ConnectForm
            phone={phone}
            setPhone={setPhone}
            mode={mode}
            setMode={setMode}
            connecting={connecting}
            error={error}
            gateway={status.gateway}
            onStartPairing={startPairing}
            onStartQr={startQr}
            forceNew
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-df-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-navy">Connect WhatsApp</p>
      <p className="mt-1 text-xs text-muted">No WhatsApp session is linked yet. Choose a way to connect the DeployFleet outreach number.</p>
      <ConnectForm
        phone={phone}
        setPhone={setPhone}
        mode={mode}
        setMode={setMode}
        connecting={connecting}
        error={error}
        gateway={status.gateway}
        onStartPairing={startPairing}
        onStartQr={startQr}
      />
    </div>
  );
}

function ConnectForm({
  phone,
  setPhone,
  mode,
  setMode,
  connecting,
  error,
  gateway,
  onStartPairing,
  onStartQr,
  forceNew,
}: {
  phone: string;
  setPhone: (v: string) => void;
  mode: "pairing" | "qr" | null;
  setMode: (v: "pairing" | "qr" | null) => void;
  connecting: boolean;
  error: string | null;
  gateway: GatewayStatus;
  onStartPairing: () => void;
  onStartQr: () => void;
  forceNew?: boolean;
}) {
  return (
    <div className="mt-3">
      {!mode && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("pairing")} className="btn-primary text-xs">
            Pairing code
          </button>
          <button type="button" onClick={() => setMode("qr")} className="btn-secondary text-xs">
            QR code
          </button>
        </div>
      )}

      {mode === "pairing" && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted">Enter the DeployFleet WhatsApp number, digits only, no + (e.g. 260979046745).</p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="260979046745"
              className="min-w-0 flex-1 rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
            />
            <button type="button" onClick={onStartPairing} disabled={connecting || !phone.trim()} className="btn-primary text-xs disabled:opacity-50">
              {connecting ? "Starting…" : forceNew ? "Reconnect" : "Get code"}
            </button>
          </div>
          {gateway.linkCode && (
            <div className="rounded-df-md border border-teal/30 bg-teal/10 p-3 text-center">
              <p className="text-[11px] text-muted">Enter this in WhatsApp → Linked Devices → Link with phone number instead:</p>
              <p className="mt-1 text-2xl font-bold tracking-widest text-navy">{gateway.linkCode}</p>
            </div>
          )}
          {gateway.status === "connecting" && !gateway.linkCode && <p className="text-[11px] text-muted">Waiting for a code…</p>}
        </div>
      )}

      {mode === "qr" && (
        <div className="mt-2 space-y-2">
          <button type="button" onClick={onStartQr} disabled={connecting} className="btn-primary text-xs disabled:opacity-50">
            {connecting ? "Starting…" : forceNew ? "Reconnect" : "Generate QR code"}
          </button>
          {gateway.qrDataUrl && (
            <div className="rounded-df-md border border-teal/30 bg-teal/10 p-3 text-center">
              <p className="mb-2 text-[11px] text-muted">Scan with WhatsApp → Linked Devices → Link a Device (expires in 3 minutes):</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a base64 data URL, not something Next's image loader can optimize */}
              <img src={gateway.qrDataUrl} alt="WhatsApp QR code" className="mx-auto h-48 w-48" />
            </div>
          )}
          {gateway.status === "connecting" && !gateway.qrDataUrl && <p className="text-[11px] text-muted">Generating QR code…</p>}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
