"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useVisitorData } from "@fingerprint/react";
import { analytics } from "@/lib/analytics/client";
import { fingerprintConfigured } from "./FingerprintBoundary";

/**
 * Replaces the old PageviewTracker — mounted once in the root layout,
 * inside FingerprintBoundary. Renders nothing.
 *
 * Two variants because useVisitorData() can't be called conditionally
 * (React hook rules) but only makes sense inside <FingerprintProvider> —
 * same reason FingerprintBoundary itself branches on configuration.
 */
export default function VisitorTracker() {
  return fingerprintConfigured ? <FingerprintAwareTracker /> : <PlainTracker />;
}

function PlainTracker() {
  const pathname = usePathname();
  useEffect(() => {
    void analytics.page(pathname, document.title);
  }, [pathname]);
  return null;
}

/**
 * Waits (briefly, non-blockingly) for the Fingerprint agent to resolve an
 * event_id before the *first* page() call, so identify() has a realistic
 * chance of including it rather than losing the race and permanently
 * falling back to the legacy-id path for this tab load (identify() only
 * ever runs once — see client.ts). Every subsequent pathname change fires
 * immediately regardless, same as PlainTracker.
 */
function FingerprintAwareTracker() {
  const pathname = usePathname();
  const { data, isFetched, error } = useVisitorData({ immediate: true });
  const lastFiredPathname = useRef<string | null>(null);

  useEffect(() => {
    if (isFetched && data?.event_id) {
      analytics.setFingerprintRequestId(data.event_id);
    }
    if (error) {
      // Ad blocker / privacy browser / network failure — proceed without
      // it (spec §28's "gracefully fail if Fingerprint is unavailable").
      console.error("Fingerprint identification failed", error);
    }
  }, [isFetched, data, error]);

  useEffect(() => {
    // Once we've fired at least once, every pathname change fires again
    // immediately. Before the first fire, wait for the agent to resolve
    // (isFetched) or fail (error) so the first identify() call has a
    // real chance of carrying a requestId instead of losing the race.
    const readyForFirstFire = lastFiredPathname.current !== null || isFetched || Boolean(error);
    if (!readyForFirstFire || lastFiredPathname.current === pathname) return;
    lastFiredPathname.current = pathname;
    void analytics.page(pathname, document.title);
  }, [pathname, isFetched, error]);

  return null;
}
