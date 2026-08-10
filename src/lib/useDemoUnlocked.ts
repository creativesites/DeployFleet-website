"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "deployfleet-demo-unlocked";
/** localStorage's native "storage" event only fires in *other* tabs — this custom event covers same-tab writes so useSyncExternalStore re-renders immediately after unlock(). */
const CHANGE_EVENT = "deployfleet-demo-unlock-changed";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * The gated-demo-access unlock state — per-browser via localStorage, the
 * same pattern already established for the selected country
 * (useSelectedCountry.ts) and for the same reasons: hydration-safe by
 * construction (the server always renders the gated/locked state) and
 * avoids the set-state-in-effect lint anti-pattern a useEffect-based
 * version would hit.
 */
export function useDemoUnlocked() {
  const unlocked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function unlock() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return { unlocked, unlock };
}
