"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_COUNTRY_CODE, getCountry, type CountryCode, type CountryConfig } from "@/lib/countries";
import type { DieselPriceOverride } from "@/app/api/diesel-price/route";

const STORAGE_KEY = "deployfleet-intelligence-hub-country";
/** localStorage's native "storage" event only fires in *other* tabs — this custom event covers same-tab writes so useSyncExternalStore re-renders immediately after selectCountry(). */
const CHANGE_EVENT = "deployfleet-country-changed";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): CountryCode {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? (stored as CountryCode) : DEFAULT_COUNTRY_CODE;
}

function getServerSnapshot(): CountryCode {
  return DEFAULT_COUNTRY_CODE;
}

/**
 * The selected country persists per-browser (localStorage), the same
 * "yours alone, not server-side history" precedent already used for
 * calculator inputs elsewhere in the Intelligence Hub — no accounts, no
 * server state. Defaults to Zambia. Built on useSyncExternalStore rather
 * than a useState+useEffect read, which is the React-recommended pattern
 * for external mutable state — it's hydration-safe by construction
 * (getServerSnapshot always returns Zambia, matching the server-rendered
 * HTML) and avoids the "setState synchronously in an effect" anti-pattern
 * a useEffect-based version would hit.
 */
export function useSelectedCountry() {
  const countryCode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dieselOverrides, setDieselOverrides] = useState<Partial<Record<CountryCode, DieselPriceOverride>>>({});

  // Admin-set diesel prices (see /admin) load once per page visit and
  // merge over the static sourced default — this is the one figure
  // volatile enough to need updating without a code deploy. Every other
  // country field (tax bands, tolls) still comes from the static,
  // PR-reviewed src/lib/countries.ts, unchanged.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/diesel-price")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setDieselOverrides(data.overrides);
      })
      .catch(() => {
        // No override fetched — the static sourced default still applies, same graceful-degradation contract as the AI Insight panel.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectCountry(code: CountryCode) {
    window.localStorage.setItem(STORAGE_KEY, code);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const baseCountry = getCountry(countryCode);
  const override = dieselOverrides[countryCode];
  const country: CountryConfig =
    override && baseCountry.dieselPricePerLitre
      ? {
          ...baseCountry,
          dieselPricePerLitre: {
            ...baseCountry.dieselPricePerLitre,
            value: override.value,
            asOf: override.asOf,
            source: "DeployFleet admin dashboard",
            confidence: "high",
            note: "Manually updated via /admin, overriding the static sourced default below.",
          },
        }
      : baseCountry;

  return { country, countryCode, selectCountry };
}
