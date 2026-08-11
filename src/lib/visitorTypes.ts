/**
 * Visitor Intelligence 2.0 — pure types + pure helpers, no Firebase
 * imports. Safe to import from client tracking code (src/lib/analytics/
 * client.ts) and server code alike (src/lib/visitorIntelligence.ts, the
 * /api/analytics/* route handlers), same split as leadTypes.ts/crmTypes.ts.
 *
 * Field names are a Firestore-document adaptation of the SQL-table shape
 * in the Visitor Intelligence 2.0 spec — camelCase instead of snake_case
 * to match this codebase's existing convention (see Company/Activity in
 * crmTypes.ts), nested UTM/geo objects instead of ~15 flat columns.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type LocationSource = "fingerprint" | "ip_geolocation" | "browser_geolocation" | "manual" | "unknown";

/** Spec §12 — the source classifier's output vocabulary. */
export type ReferrerType =
  | "direct"
  | "organic_search"
  | "paid_search"
  | "social"
  | "whatsapp"
  | "referral"
  | "campaign"
  | "unknown";

/** Spec §18 — anonymous until legitimately identified via a lead/company. */
export type VisitorStatus = "anonymous" | "identified";

export interface UtmParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  gclid: string | null;
  fbclid: string | null;
  liFatId: string | null;
  msclkid: string | null;
}

export const EMPTY_UTM: UtmParams = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  gclid: null,
  fbclid: null,
  liFatId: null,
  msclkid: null,
};

export function hasUtmSignal(utm: UtmParams): boolean {
  return Object.values(utm).some((v) => v !== null);
}

/**
 * Spec §12 — deterministic source classification. Pure so it can run
 * client-side (session start) and be re-verified server-side (never
 * trust the client's own classification for anything security-relevant,
 * though this is marketing-attribution data, not an access decision).
 */
export function classifyReferrer(referrerUrl: string | null, utm: UtmParams): ReferrerType {
  if (utm.gclid || utm.utmMedium === "cpc" || utm.utmMedium === "ppc") return "paid_search";
  if (utm.utmMedium === "social" || utm.fbclid || utm.liFatId) return "social";
  if (utm.utmSource === "whatsapp" || utm.utmMedium === "whatsapp") return "whatsapp";
  if (utm.utmCampaign || utm.utmSource) return "campaign";
  if (!referrerUrl) return "direct";

  let host: string;
  try {
    host = new URL(referrerUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }

  if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\./.test(host)) return "organic_search";
  if (/facebook\.com|fb\.com/.test(host)) return "social";
  if (/linkedin\.com/.test(host)) return "social";
  if (/wa\.me|whatsapp\.com/.test(host)) return "whatsapp";
  if (host === "deployfleet.com" || host.endsWith(".deployfleet.com")) return "direct";
  return "referral";
}

export function referrerDomain(referrerUrl: string | null): string | null {
  if (!referrerUrl) return null;
  try {
    return new URL(referrerUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface Visitor {
  id: string;
  fingerprintVisitorId: string | null;
  /** Pre-Fingerprint localStorage UUIDs folded into this visitor during backfill/merge — see visitorIntelligence.ts's mergeLegacyVisitorId(). */
  legacyVisitorIds: string[];

  firstSeenAt: string;
  lastSeenAt: string;

  totalSessions: number;
  totalPageViews: number;
  totalEvents: number;
  totalActiveSeconds: number;
  /** Internal accumulator (sum of every ended session's durationSeconds) — averageSessionSeconds is derived from this / totalSessions on read, not stored pre-divided, so it never drifts out of sync with the two inputs it depends on. */
  totalSessionDurationSeconds: number;
  averageSessionSeconds: number;

  firstLandingPage: string | null;
  lastLandingPage: string | null;
  lastPage: string | null;
  mostViewedPage: string | null;
  /** pagePath -> view count, used to derive mostViewedPage. Small map, fine to store inline. */
  pageViewCounts: Record<string, number>;

  firstReferrer: string | null;
  lastReferrer: string | null;
  firstReferrerType: ReferrerType;
  lastReferrerType: ReferrerType;

  firstUtm: UtmParams;
  lastUtm: UtmParams;

  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  locationSource: LocationSource;

  deviceType: DeviceType;
  browser: string | null;
  browserVersion: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  language: string | null;

  isBot: boolean;
  isVpn: boolean;
  isIncognito: boolean;
  isProxy: boolean;
  /** Fingerprint's own confidence score for the visitorId match (0-1), null pre-Fingerprint. */
  confidenceScore: number | null;

  status: VisitorStatus;
  leadId: string | null;
  companyId: string | null;

  engagementScore: number;
  intentScore: number;

  createdAt: string;
  updatedAt: string;
}

export interface VisitorSession {
  id: string;
  visitorId: string;

  startedAt: string;
  lastActivityAt: string;
  endedAt: string | null;
  durationSeconds: number;
  activeSeconds: number;

  landingPage: string;
  exitPage: string | null;
  pageViews: number;
  eventCount: number;

  referrer: string | null;
  referrerDomain: string | null;
  referrerType: ReferrerType;
  utm: UtmParams;

  deviceType: DeviceType;
  browser: string | null;
  operatingSystem: string | null;

  country: string | null;
  region: string | null;
  city: string | null;

  isBounce: boolean;
  isEngaged: boolean;
  engagementScore: number;

  createdAt: string;
  updatedAt: string;
}

/** Spec §6 — the fixed event-type vocabulary. */
export type EventType =
  | "page_view"
  | "page_exit"
  | "session_start"
  | "session_end"
  | "scroll"
  | "engaged_view"
  | "click"
  | "cta_click"
  | "form_start"
  | "form_field_focus"
  | "form_submit"
  | "form_success"
  | "form_error"
  | "phone_click"
  | "email_click"
  | "whatsapp_click"
  | "demo_request"
  | "contact_request"
  | "pricing_view"
  | "pricing_interaction"
  | "calculator_start"
  | "calculator_complete"
  | "download"
  | "outbound_link_click"
  | "video_start"
  | "video_progress"
  | "video_complete"
  | "search"
  | "faq_open"
  | "navigation_click"
  | "error";

/** Standardized conversion events — spec §33, a fixed subset of EventType. */
export const CONVERSION_EVENT_TYPES: EventType[] = [
  "demo_request",
  "contact_request",
  "whatsapp_click",
  "phone_click",
  "email_click",
  "calculator_complete",
  "download",
];

export interface VisitorEvent {
  id: string;
  visitorId: string;
  sessionId: string;

  eventType: EventType;
  eventName: string | null;

  pageUrl: string | null;
  pagePath: string | null;
  pageTitle: string | null;

  timestamp: string;
  durationMs: number | null;

  elementId: string | null;
  elementText: string | null;
  elementType: string | null;

  /** Free-form, event-specific — e.g. { depth: 75 } for scroll, { cta: "request_demo", location: "hero" } for cta_click. Never sensitive form values (spec §10/§29). */
  metadata: Record<string, unknown> | null;

  referrer: string | null;
  utm: UtmParams;

  createdAt: string;
}
