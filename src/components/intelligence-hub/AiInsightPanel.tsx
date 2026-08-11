"use client";

import { useState } from "react";
import { analytics } from "@/lib/analytics/client";

type PanelState = "idle" | "loading" | "success" | "unavailable";

/**
 * Layer 2, ambient and optional — every calculator's engine has already
 * produced a correct number before this ever renders. Manual trigger by
 * design (not auto-fetched on every keystroke): keeps AI spend tied to
 * genuine interest, not every recalculation. Failure/no-key/rate-limited
 * all collapse into the same calm "unavailable" state per the plan §04
 * contract — the user is never shown an error, just told their numbers
 * are still correct.
 */
export function AiInsightPanel({
  feature,
  buildPrompt,
  disabled = false,
}: {
  feature: string;
  buildPrompt: () => string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<PanelState>("idle");
  const [text, setText] = useState("");

  async function fetchInsight() {
    // Wired here rather than in each of the 9 calculators individually:
    // this shared panel is the one discrete, intentional action available
    // in an otherwise live-recalculating (useMemo-on-every-keystroke) UI
    // with no explicit "Calculate"/submit button to hang calculator_start/
    // calculator_complete off of — "asked for the AI insight" is treated
    // as the calculator_complete signal (spec §33), a deliberate proxy,
    // not a literal form-completion event.
    void analytics.conversion("calculator_complete", { feature });
    setState("loading");
    try {
      const response = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, prompt: buildPrompt() }),
      });
      const data = await response.json();
      if (data?.ok && typeof data.text === "string") {
        setText(data.text);
        setState("success");
      } else {
        setState("unavailable");
      }
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div
      className="mt-6 rounded-df-lg border p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--df-ai-violet) 22%, var(--df-border))",
        background: "color-mix(in srgb, var(--df-ai-violet) 4%, var(--df-card))",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            background: "color-mix(in srgb, var(--df-ai-violet) 14%, transparent)",
            color: "var(--df-ai-violet)",
          }}
        >
          AI
        </span>
        <p className="text-sm font-semibold text-navy">AI Insight</p>
      </div>

      {state === "idle" && (
        <>
          <p className="mt-2 text-sm text-muted">
            Get a plain-language explanation of this result, and a
            suggestion if there&apos;s an obvious one.
          </p>
          <button
            type="button"
            onClick={fetchInsight}
            disabled={disabled}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--df-ai-violet)" }}
          >
            Get AI Insight
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      {state === "loading" && (
        <p className="mt-2 text-sm text-muted">Thinking…</p>
      )}

      {state === "success" && (
        <p className="mt-2 text-sm leading-relaxed text-body">{text}</p>
      )}

      {state === "unavailable" && (
        <p className="mt-2 text-sm text-muted">
          AI insights are temporarily unavailable. Your calculation above is
          correct either way.
        </p>
      )}
    </div>
  );
}
