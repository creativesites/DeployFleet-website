"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_COUNTRY_CODE, getCountry, type CountryCode } from "@/lib/countries";

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

  function selectCountry(code: CountryCode) {
    window.localStorage.setItem(STORAGE_KEY, code);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return { country: getCountry(countryCode), countryCode, selectCountry };
}
