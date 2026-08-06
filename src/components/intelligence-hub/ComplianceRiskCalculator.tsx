"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateComplianceRisk, type ComplianceItemInput } from "@/lib/calculators/complianceRisk";
import { whatsappHref } from "@/lib/nav";
import { NumberField, TextField, DateField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type ItemFormState = {
  name: string;
  expiryDate: string;
  renewalCostZmw: string;
  estimatedPenaltyIfExpiredZmw: string;
};

const initialItems: ItemFormState[] = [
  { name: "Insurance", expiryDate: "", renewalCostZmw: "", estimatedPenaltyIfExpiredZmw: "" },
  { name: "Road Tax / Licence", expiryDate: "", renewalCostZmw: "", estimatedPenaltyIfExpiredZmw: "" },
  { name: "Fitness Certificate", expiryDate: "", renewalCostZmw: "", estimatedPenaltyIfExpiredZmw: "" },
  { name: "Route Permit", expiryDate: "", renewalCostZmw: "", estimatedPenaltyIfExpiredZmw: "" },
];

const statusCopy: Record<string, { label: string; className: string }> = {
  expired: { label: "Expired", className: "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger" },
  "expiring-soon": { label: "Expiring soon", className: "bg-[color-mix(in_srgb,var(--df-amber)_14%,transparent)] text-amber" },
  valid: { label: "Valid", className: "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald" },
  "invalid-date": { label: "No date set", className: "bg-[color-mix(in_srgb,var(--df-border)_60%,transparent)] text-muted" },
};

export default function ComplianceRiskCalculator() {
  const [items, setItems] = useState<ItemFormState[]>(initialItems);
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));

  function updateItem<K extends keyof ItemFormState>(index: number, key: K, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  const engineItems: ComplianceItemInput[] = useMemo(
    () =>
      items.map((item) => ({
        name: item.name || "Untitled document",
        expiryDate: item.expiryDate,
        renewalCostZmw: toNumber(item.renewalCostZmw),
        estimatedPenaltyIfExpiredZmw: toNumber(item.estimatedPenaltyIfExpiredZmw),
      })),
    [items]
  );

  const result = useMemo(
    () => calculateComplianceRisk({ items: engineItems, todayIso }),
    [engineItems, todayIso]
  );
  const hasEnoughToShow = items.some((item) => item.expiryDate);

  function buildAiPrompt(): string {
    const lines = result.items
      .filter((i) => i.status !== "invalid-date")
      .map((i) => `- ${i.name}: ${i.status}, ${i.daysUntilExpiry} days until expiry`);
    return `Compliance risk check across ${result.items.length} tracked documents:
${lines.join("\n")}
- Expired: ${result.expiredCount}, Expiring soon (30d): ${result.expiringSoonCount}, Valid: ${result.validCount}
- Total renewal cost tracked: ${formatZmw(result.totalRenewalCostZmw)}
- Total penalty exposure from currently-expired documents: ${formatZmw(result.totalPenaltyExposureZmw)}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Compliance &amp; Penalty Risk</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What&apos;s about to expire, and what could it cost you?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Track a truck&apos;s recurring compliance documents in one place —
          expiry countdown, renewal cost, and what you estimate it would
          cost if caught operating on an expired one. Rename any row to
          match what you actually track.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {items.map((item, index) => (
            <fieldset key={index} className="card-surface p-6">
              <legend className="px-1 text-sm font-semibold text-navy">Document {index + 1}</legend>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id={`name-${index}`}
                  label="Document name"
                  value={item.name}
                  onChange={(v) => updateItem(index, "name", v)}
                />
                <DateField
                  id={`expiry-${index}`}
                  label="Expiry date"
                  value={item.expiryDate}
                  onChange={(v) => updateItem(index, "expiryDate", v)}
                />
                <NumberField
                  id={`cost-${index}`}
                  label="Renewal cost (ZMW)"
                  value={item.renewalCostZmw}
                  onChange={(v) => updateItem(index, "renewalCostZmw", v)}
                  placeholder="0"
                />
                <NumberField
                  id={`penalty-${index}`}
                  label="Estimated penalty if expired (ZMW)"
                  value={item.estimatedPenaltyIfExpiredZmw}
                  onChange={(v) => updateItem(index, "estimatedPenaltyIfExpiredZmw", v)}
                  placeholder="0"
                  hint="Your own estimate — a fine, impoundment cost, or lost-trip cost. Not a published rate."
                />
              </div>
            </fieldset>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Total renewal cost tracked</p>
                <p className="mt-1 text-4xl font-bold text-navy">{formatZmw(result.totalRenewalCostZmw)}</p>
                {result.totalPenaltyExposureZmw > 0 && (
                  <p className="mt-1 text-sm text-danger">
                    {formatZmw(result.totalPenaltyExposureZmw)} estimated penalty exposure right now
                  </p>
                )}

                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  {result.items.map((item) => {
                    const status = statusCopy[item.status];
                    return (
                      <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-body">{item.name}</span>
                        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                          {item.status === "invalid-date"
                            ? status.label
                            : item.daysUntilExpiry < 0
                              ? `${status.label} (${Math.abs(item.daysUntilExpiry)}d ago)`
                              : `${status.label} (${item.daysUntilExpiry}d)`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {result.soonestExpiring && (
                  <p className="mt-4 text-xs text-muted">
                    Next up: {result.soonestExpiring.name} in {result.soonestExpiring.daysUntilExpiry} days.
                  </p>
                )}

                <AiInsightPanel feature="compliance-risk" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Add an expiry date to at least one document to see your risk summary.</p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Never miss a renewal again</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet blocks dispatch automatically on an expired
              document and flags what&apos;s expiring soon — before it
              becomes a roadside problem.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/demo" className="btn-primary justify-center text-sm">
                View Demo
              </Link>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center text-sm">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
