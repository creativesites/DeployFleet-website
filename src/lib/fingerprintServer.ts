import "server-only";
import { FingerprintServerApiClient, Region, type Event } from "@fingerprint/node-sdk";
import type { DeviceType, LocationSource } from "./visitorTypes";

/**
 * Spec §3 — the server-side trust boundary. The client (see
 * src/lib/analytics/client.ts) only ever gets a `requestId` (the JS
 * agent's `event_id`) back from Fingerprint — never a visitorId,
 * confidence score, or device/bot signal it could tamper with. This
 * module takes that requestId, calls Fingerprint's own Server API (via
 * the official @fingerprint/node-sdk, not a hand-rolled fetch against a
 * guessed response schema — field names below are read directly from
 * that package's generated OpenAPI types, dist/index.d.ts), and returns
 * the one, trusted identification result. /api/analytics/identify is the
 * only caller.
 */

export function isFingerprintServerConfigured(): boolean {
  return Boolean(process.env.FINGERPRINT_SERVER_API_KEY);
}

function resolveRegion(): Region {
  const raw = (process.env.FINGERPRINT_REGION ?? "global").trim().toLowerCase();
  if (raw === "eu") return Region.EU;
  if (raw === "ap") return Region.AP;
  return Region.Global;
}

let client: FingerprintServerApiClient | null = null;

function getClient(): FingerprintServerApiClient {
  if (client) return client;
  client = new FingerprintServerApiClient({
    apiKey: process.env.FINGERPRINT_SERVER_API_KEY as string,
    region: resolveRegion(),
  });
  return client;
}

export interface FingerprintIdentification {
  fingerprintVisitorId: string | null;
  confidenceScore: number | null;
  isBot: boolean;
  isVpn: boolean;
  isIncognito: boolean;
  isProxy: boolean;
  deviceType: DeviceType;
  browser: string | null;
  browserVersion: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  locationSource: LocationSource;
}

/**
 * Best-effort device-category heuristic — Fingerprint's `device` field is
 * a free-text model string (e.g. "iPhone", "Other", "Samsung SM-G950F"),
 * not a desktop/mobile/tablet enum, so this is pattern-matching, not an
 * authoritative signal. Good enough for the marketing-dashboard device
 * breakdown (spec §4/§23); not something to depend on for anything else.
 */
function classifyDeviceType(os: string | null, device: string | null): DeviceType {
  const osLower = (os ?? "").toLowerCase();
  const deviceLower = (device ?? "").toLowerCase();

  if (deviceLower.includes("ipad") || deviceLower.includes("tab") || osLower.includes("ipados")) return "tablet";
  if (osLower.includes("ios") || osLower.includes("android")) return "mobile";
  if (osLower.includes("windows") || osLower.includes("mac os") || osLower.includes("linux")) return "desktop";
  return "unknown";
}

function extractGeolocation(event: Event): NonNullable<NonNullable<Event["ip_info"]>["v4"]>["geolocation"] | undefined {
  return event.ip_info?.v4?.geolocation ?? event.ip_info?.v6?.geolocation;
}

/**
 * Returns null (never throws) on any failure — unconfigured, bad
 * requestId, network error, rate limit — so a Fingerprint outage degrades
 * to anonymous tracking rather than breaking the site (spec §28). The
 * caller (identify route) falls back to createAnonymousVisitor()-style
 * handling when this returns null.
 */
export async function identifyFromFingerprintRequestId(requestId: string): Promise<FingerprintIdentification | null> {
  if (!isFingerprintServerConfigured()) return null;

  try {
    const event = await getClient().getEvent(requestId);
    const geo = extractGeolocation(event);
    const browserDetails = event.browser_details;

    return {
      fingerprintVisitorId: event.identification?.visitor_id ?? null,
      confidenceScore: event.identification?.confidence?.score ?? null,
      isBot: Boolean(event.bot) && event.bot !== "not_detected",
      isVpn: Boolean(event.vpn),
      isIncognito: Boolean(event.incognito),
      isProxy: Boolean(event.proxy),
      deviceType: classifyDeviceType(browserDetails?.os ?? event.os ?? null, browserDetails?.device ?? event.device ?? null),
      browser: browserDetails?.browser_name ?? null,
      browserVersion: browserDetails?.browser_major_version ?? null,
      operatingSystem: browserDetails?.os ?? event.os ?? null,
      osVersion: browserDetails?.os_version ?? event.os_version ?? null,
      country: geo?.country_name ?? null,
      countryCode: geo?.country_code ?? null,
      region: geo?.subdivisions?.[0]?.name ?? null,
      city: geo?.city_name ?? null,
      timezone: geo?.timezone ?? null,
      locationSource: geo ? "ip_geolocation" : "unknown",
    };
  } catch (error) {
    console.error("Fingerprint Server API lookup failed", error);
    return null;
  }
}
