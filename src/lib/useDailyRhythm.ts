"use client";

import { useSyncExternalStore } from "react";

/**
 * Phase 3 §9 — per-browser, per-calendar-day dismissal tracking for the
 * Morning Brief, Midday Nudge, and End-of-Day Review, so none of them
 * re-fires more than once a day just because the Command Center got
 * reloaded. Same useSyncExternalStore/localStorage pattern already
 * established by useDemoUnlocked.ts and useSelectedCountry.ts —
 * hydration-safe by construction, avoids the set-state-in-effect lint
 * anti-pattern a useEffect-based version would hit.
 */

const MORNING_BRIEF_KEY = "deployfleet-admin-morning-brief-date";
const MIDDAY_NUDGE_KEY = "deployfleet-admin-midday-nudge-date";
const EOD_REVIEW_KEY = "deployfleet-admin-eod-review-date";
const CHANGE_EVENT = "deployfleet-admin-daily-rhythm-changed";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function makeSnapshotGetters(key: string) {
  return {
    getSnapshot: () => window.localStorage.getItem(key),
    getServerSnapshot: () => null,
  };
}

const morningBrief = makeSnapshotGetters(MORNING_BRIEF_KEY);
const middayNudge = makeSnapshotGetters(MIDDAY_NUDGE_KEY);
const eodReview = makeSnapshotGetters(EOD_REVIEW_KEY);

export function useDailyRhythm() {
  const morningBriefDate = useSyncExternalStore(subscribe, morningBrief.getSnapshot, morningBrief.getServerSnapshot);
  const middayNudgeDate = useSyncExternalStore(subscribe, middayNudge.getSnapshot, middayNudge.getServerSnapshot);
  const eodReviewDate = useSyncExternalStore(subscribe, eodReview.getSnapshot, eodReview.getServerSnapshot);

  function markMorningBriefShown(dateIso: string) {
    window.localStorage.setItem(MORNING_BRIEF_KEY, dateIso);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function markMiddayNudgeShown(dateIso: string) {
    window.localStorage.setItem(MIDDAY_NUDGE_KEY, dateIso);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function markEodReviewComplete(dateIso: string) {
    window.localStorage.setItem(EOD_REVIEW_KEY, dateIso);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return {
    morningBriefDate,
    middayNudgeDate,
    eodReviewDate,
    markMorningBriefShown,
    markMiddayNudgeShown,
    markEodReviewComplete,
  };
}
