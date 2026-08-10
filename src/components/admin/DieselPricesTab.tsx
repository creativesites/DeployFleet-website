"use client";

import { useEffect, useState } from "react";
import { COUNTRY_LIST, type CountryCode } from "@/lib/countries";
import type { DieselPriceOverride } from "@/app/api/diesel-price/route";

export default function DieselPricesTab() {
  const [overrides, setOverrides] = useState<Partial<Record<CountryCode, DieselPriceOverride>>>({});
  const [persistent, setPersistent] = useState(true);
  const [drafts, setDrafts] = useState<Partial<Record<CountryCode, string>>>({});
  const [savingCode, setSavingCode] = useState<CountryCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/diesel-price")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) {
          setOverrides(data.overrides);
          setPersistent(data.persistent);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveDieselPrice(code: CountryCode) {
    const draft = drafts[code];
    const value = draft !== undefined ? Number(draft) : NaN;
    if (!Number.isFinite(value) || value <= 0) return;
    setSavingCode(code);
    const res = await fetch("/api/diesel-price", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: code, value }),
    });
    const data = await res.json();
    if (data.ok) {
      setOverrides(data.overrides);
      setPersistent(data.persistent);
      setDrafts((prev) => ({ ...prev, [code]: undefined }));
    }
    setSavingCode(null);
  }

  return (
    <div>
      {!persistent && (
        <div className="rounded-df-md border border-amber bg-[color-mix(in_srgb,var(--df-amber)_10%,transparent)] p-4 text-sm text-amber">
          Running on the in-memory fallback store — changes here will be lost on the next cold start/redeploy.
          Attach a Redis/KV integration in the Vercel dashboard (any provider setting{" "}
          <code>KV_REST_API_URL</code>/<code>KV_REST_API_TOKEN</code> or <code>UPSTASH_REDIS_REST_URL</code>/
          <code>UPSTASH_REDIS_REST_TOKEN</code>) to make edits here durable — no code change needed once attached.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {COUNTRY_LIST.map((country) => {
          const override = overrides[country.code];
          const current = override?.value ?? country.dieselPricePerLitre?.value ?? null;
          const draft = drafts[country.code];
          return (
            <div key={country.code} className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-navy">
                  {country.name} <span className="text-muted">({country.currencyCode})</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {current !== null ? `Current: ${current} ${country.currencyCode}/L` : "No diesel price sourced yet"}
                  {override ? ` — admin override as of ${override.asOf}` : country.dieselPricePerLitre ? " — from sourced default" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder={current !== null ? current.toString() : "e.g. 26.86"}
                  value={draft ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [country.code]: e.target.value }))}
                  className="w-28 rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
                />
                <button
                  type="button"
                  onClick={() => saveDieselPrice(country.code)}
                  disabled={savingCode === country.code || !draft}
                  className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingCode === country.code ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted">
        Only diesel price is editable here today. Tax bands, tolls, and social security rates still live in{" "}
        <code>src/lib/countries.ts</code>, edited via a reviewed PR — those change far less often and carry more
        correctness risk, so a from-scratch nested-object editor wasn&apos;t built for them in this round.
      </p>
    </div>
  );
}
