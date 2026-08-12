"use client";

import { useState } from "react";

/**
 * "Copy briefing for [employee]" — see src/lib/ai/briefing.ts for the
 * reasoning. One click: fetch a ready-to-paste text block (this
 * employee's role/mission/instructions + everything this app knows
 * about the prospect) and put it on the clipboard, so Winston can paste
 * it straight into his external chat with that AI teammate instead of
 * re-typing prospect context by hand every time.
 */
export default function CopyBriefingButton({
  employeeId,
  employeeName,
  prospectId,
  purpose,
  className,
}: {
  employeeId: string;
  employeeName: string;
  prospectId?: string | null;
  purpose?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  async function copyBriefing() {
    setState("loading");
    setFallbackText(null);
    try {
      const res = await fetch("/api/admin/crm/team/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, prospectId: prospectId ?? undefined, purpose }),
      });
      const data = await res.json();
      if (!data.ok) {
        setState("error");
        return;
      }
      try {
        await navigator.clipboard.writeText(data.briefing);
        setState("copied");
        setTimeout(() => setState("idle"), 2500);
      } catch {
        // Clipboard permission denied (or no secure-context clipboard API) —
        // fall back to showing the text so Winston can still select-and-copy it.
        setFallbackText(data.briefing);
        setState("idle");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={copyBriefing}
        disabled={state === "loading"}
        className="text-[11px] font-medium text-teal hover:underline disabled:opacity-50"
      >
        {state === "loading" ? "Preparing…" : state === "copied" ? `Copied — paste into your chat with ${employeeName}` : `Copy briefing for ${employeeName}`}
      </button>
      {state === "error" && <p className="mt-1 text-[11px] text-danger">Couldn&apos;t prepare that briefing — try again.</p>}
      {fallbackText && (
        <div className="mt-1.5">
          <p className="text-[11px] text-muted">Clipboard access was blocked — select and copy manually:</p>
          <textarea
            readOnly
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
            rows={4}
            className="mt-1 w-full rounded-df-md border border-border bg-canvas p-2 text-[11px] text-navy outline-none focus:border-teal"
          />
        </div>
      )}
    </div>
  );
}
