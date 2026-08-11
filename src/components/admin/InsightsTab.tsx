"use client";

import { useEffect, useState } from "react";

interface AlertItem {
  id: string;
  severity: "info" | "notice" | "high";
  title: string;
  detail: string;
}

const SEVERITY_COLOR: Record<AlertItem["severity"], string> = {
  high: "#ef4444",
  notice: "#eab308",
  info: "#0ea5e9",
};

type AiState = "idle" | "loading" | "success" | "unavailable";

export default function InsightsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch("/api/admin/analytics/insights")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setAlerts(data.alerts);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured]);

  async function generateAiInsight() {
    setAiState("loading");
    try {
      const res = await fetch("/api/admin/analytics/ai-insight", { method: "POST" });
      const data = await res.json();
      if (data?.ok && typeof data.text === "string") {
        setAiText(data.text);
        setAiState("success");
      } else {
        setAiState("unavailable");
      }
    } catch {
      setAiState("unavailable");
    }
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see insights. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load alerts ({error}).</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-navy">Alerts</h2>
        <p className="mt-1 text-xs text-muted">
          Computed fresh on every visit — not push notifications (no email/Slack delivery is wired up yet).
        </p>
        {!alerts ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing worth flagging right now.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="card-surface flex items-start gap-3 p-4">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SEVERITY_COLOR[alert.severity] }}
                />
                <div>
                  <p className="text-sm font-medium text-navy">{alert.title}</p>
                  {alert.detail && <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-df-lg border p-5"
        style={{
          borderColor: "color-mix(in srgb, var(--df-ai-violet, #a855f7) 22%, var(--df-border))",
          background: "color-mix(in srgb, var(--df-ai-violet, #a855f7) 4%, var(--df-card))",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ background: "color-mix(in srgb, var(--df-ai-violet, #a855f7) 14%, transparent)", color: "var(--df-ai-violet, #a855f7)" }}
          >
            AI
          </span>
          <p className="text-sm font-semibold text-navy">Marketing Insight</p>
        </div>

        {aiState === "idle" && (
          <>
            <p className="mt-2 text-sm text-muted">
              Generate a plain-language summary of the funnel, top channels, top pages, and top countries above —
              built from the same aggregated numbers, no individual visitor data sent anywhere.
            </p>
            <button
              type="button"
              onClick={generateAiInsight}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: "var(--df-ai-violet, #a855f7)" }}
            >
              Generate Insight
            </button>
          </>
        )}
        {aiState === "loading" && <p className="mt-2 text-sm text-muted">Thinking…</p>}
        {aiState === "success" && <p className="mt-2 text-sm leading-relaxed text-body">{aiText}</p>}
        {aiState === "unavailable" && (
          <p className="mt-2 text-sm text-muted">
            AI insights are temporarily unavailable — check that <code>DEEPSEEK_API_KEY</code> or{" "}
            <code>GEMINI_API_KEY</code> is set.
          </p>
        )}
      </div>
    </div>
  );
}
