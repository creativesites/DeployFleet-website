"use client";

import type { EventType, UtmParams } from "../visitorTypes";

/**
 * Spec §31 — the reusable client analytics SDK every tracking call site
 * should go through, instead of hand-rolling fetch() calls in random
 * components (spec §43's "clean services/modules" architectural rule).
 * A singleton module instance, not a React context — the same pattern as
 * this file being imported directly by VisitorTracker.tsx and by
 * individual CTA components (WhatsApp buttons, calculators, etc.) alike.
 *
 * Every method fails silently (console.error, never throws) — a tracking
 * failure must never be visible to the visitor or break the page (spec
 * §28). Nothing here blocks rendering; every call is fire-and-forget.
 */

const LEGACY_VISITOR_ID_KEY = "deployfleet-visitor-id"; // same key pageviews.ts already used — reused so identify() can fold pre-Fingerprint visitors into their new visitor record (see mergeLegacyVisitorId in visitorIntelligence.ts / the identify route)
const VISITOR_ID_KEY = "df_visitor_id";
const SESSION_ID_KEY = "df_session_id";

/** Spec §7 — 10-15s heartbeat cadence while the page is visible. */
const HEARTBEAT_INTERVAL_MS = 15_000;

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing / storage disabled — degrade to per-load identity rather than failing.
  }
}

function getLegacyVisitorId(): string {
  const existing = safeGet(window.localStorage, LEGACY_VISITOR_ID_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  safeSet(window.localStorage, LEGACY_VISITOR_ID_KEY, generated);
  return generated;
}

/** Spec §11 — UTM + click-id capture from the current URL. */
function parseUtm(url: URL): UtmParams {
  const p = url.searchParams;
  return {
    utmSource: p.get("utm_source"),
    utmMedium: p.get("utm_medium"),
    utmCampaign: p.get("utm_campaign"),
    utmTerm: p.get("utm_term"),
    utmContent: p.get("utm_content"),
    gclid: p.get("gclid"),
    fbclid: p.get("fbclid"),
    liFatId: p.get("li_fat_id"),
    msclkid: p.get("msclkid"),
  };
}

function guessDeviceType(): "mobile" | "tablet" | "desktop" | "unknown" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return ua ? "desktop" : "unknown";
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`analytics: ${path} failed`, error);
    return null;
  }
}

/** Spec §28/§7 — sendBeacon on exit, since a fetch() started during pagehide/unload can be cancelled before it completes. */
function sendBeaconJson(path: string, body: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (!navigator.sendBeacon(path, blob)) {
      void fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  } catch (error) {
    console.error(`analytics: beacon ${path} failed`, error);
  }
}

class AnalyticsClient {
  private visitorId: string | null = null;
  private sessionId: string | null = null;
  private identifyPromise: Promise<void> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStartedAt = Date.now();
  private currentPagePath: string | null = null;
  private fingerprintRequestId: string | null = null;
  private listenersBound = false;

  /** Set once the Fingerprint JS agent resolves (see FingerprintBoundary) — identify() reads it if available but never blocks waiting on it beyond its own request lifecycle. Without it, identify() still proceeds on the legacy localStorage id alone (spec §28's "gracefully fail if Fingerprint is unavailable"). */
  setFingerprintRequestId(requestId: string | null): void {
    this.fingerprintRequestId = requestId;
  }

  async identify(): Promise<void> {
    if (this.identifyPromise) return this.identifyPromise;
    this.identifyPromise = (async () => {
      const stored = safeGet(window.localStorage, VISITOR_ID_KEY);
      const legacyVisitorId = getLegacyVisitorId();
      const result = await postJson<{ visitorId: string }>("/api/analytics/identify", {
        requestId: this.fingerprintRequestId,
        legacyVisitorId,
        screenWidth: window.screen?.width ?? null,
        screenHeight: window.screen?.height ?? null,
        language: navigator.language ?? null,
      });
      this.visitorId = result?.visitorId ?? stored ?? legacyVisitorId;
      if (result?.visitorId) safeSet(window.localStorage, VISITOR_ID_KEY, result.visitorId);
    })();
    return this.identifyPromise;
  }

  /** Spec §5 — resumes the stored sessionId server-side if it's still within the inactivity window, otherwise starts a new one. Safe to call on every route change; cheap no-op work on the server when resuming. */
  private async startOrResumeSession(landingPath: string): Promise<void> {
    await this.identify();
    if (!this.visitorId) return;

    const url = new URL(window.location.href);
    const result = await postJson<{ sessionId: string }>("/api/analytics/session/start", {
      visitorId: this.visitorId,
      clientSessionId: safeGet(window.sessionStorage, SESSION_ID_KEY),
      landingPage: landingPath,
      referrer: document.referrer || null,
      utm: parseUtm(url),
      deviceType: guessDeviceType(),
    });
    if (!result?.sessionId) return;

    const isNewSession = result.sessionId !== this.sessionId;
    this.sessionId = result.sessionId;
    safeSet(window.sessionStorage, SESSION_ID_KEY, result.sessionId);
    if (isNewSession) this.sessionStartedAt = Date.now();
    this.ensureHeartbeat();
  }

  /** Spec §32 — call on every meaningful route transition (initial load, client-side nav, back/forward). */
  async page(path: string, title: string | null): Promise<void> {
    await this.startOrResumeSession(path);
    this.currentPagePath = path;
    await this.track("page_view", { pagePath: path, pageTitle: title, pageUrl: window.location.href });
  }

  async track(
    eventType: EventType,
    extra: {
      eventName?: string;
      pagePath?: string;
      pageTitle?: string | null;
      pageUrl?: string;
      elementId?: string;
      elementText?: string;
      elementType?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    if (!this.visitorId || !this.sessionId) return;
    await postJson("/api/analytics/events", {
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      eventType,
      eventName: extra.eventName ?? null,
      pagePath: extra.pagePath ?? this.currentPagePath,
      pageTitle: extra.pageTitle ?? null,
      pageUrl: extra.pageUrl ?? window.location.href,
      elementId: extra.elementId ?? null,
      elementText: extra.elementText ?? null,
      elementType: extra.elementType ?? null,
      metadata: extra.metadata ?? null,
    });
  }

  /** Spec §33 — same transport as track(), a distinct name so call sites read as an intentional standardized conversion event. */
  async conversion(eventType: EventType, metadata?: Record<string, unknown>): Promise<void> {
    await this.track(eventType, { metadata });
  }

  private ensureHeartbeat(): void {
    if (!this.listenersBound) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.endSession();
      });
      window.addEventListener("pagehide", () => this.endSession());
      this.listenersBound = true;
    }
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.heartbeatTick(), HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Only sends while visible — this is the "engagement heartbeat" from
   * spec §7 in place of `nextPageTimestamp - pageViewTimestamp`. Treats
   * "visible" as "active" for v1 (no separate mouse/keyboard idle
   * detection yet) — a deliberate simplification, not the full
   * active/idle split the spec's `idle_time_seconds` field implies;
   * worth revisiting if idle time specifically becomes something the
   * dashboard needs to show.
   */
  private heartbeatTick(): void {
    if (document.visibilityState !== "visible" || !this.sessionId || !this.visitorId) return;
    void postJson("/api/analytics/session/heartbeat", {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      activeSecondsDelta: HEARTBEAT_INTERVAL_MS / 1000,
    });
  }

  endSession(): void {
    if (!this.sessionId || !this.visitorId) return;
    const durationSeconds = Math.round((Date.now() - this.sessionStartedAt) / 1000);
    sendBeaconJson("/api/analytics/session/end", {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      exitPage: this.currentPagePath,
      durationSeconds,
    });
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/** One instance for the whole app, same lifetime as the tab. */
export const analytics = new AnalyticsClient();
