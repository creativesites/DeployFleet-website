import "server-only";
import { FieldPath, FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin";
import { ENGAGEMENT_WEIGHTS, INTENT_WEIGHTS, RETURNING_SESSION_ENGAGEMENT_BONUS, RETURNING_SESSION_INTENT_BONUS, clampScore, intentCategory } from "./analytics/scoring";
import {
  CONVERSION_EVENT_TYPES,
  EMPTY_UTM,
  classifyReferrer,
  referrerDomain as domainOf,
  type DeviceType,
  type EventType,
  type LocationSource,
  type ReferrerType,
  type UtmParams,
  type Visitor,
  type VisitorEvent,
  type VisitorSession,
} from "./visitorTypes";

const VISITORS = "visitors";
const SESSIONS = "visitorSessions";
const EVENTS = "visitorEvents";

/** Spec §5 — new session after this much inactivity. Not yet admin-configurable (spec §39); centralizing it here is the seam for that later. */
const SESSION_INACTIVITY_MS = 30 * 60 * 1000;
/** Spec §15's isBounce/isEngaged session-quality thresholds. */
const BOUNCE_MAX_DURATION_SECONDS = 10;
const ENGAGED_MIN_ACTIVE_SECONDS = 30;

function tsToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function utmFromData(d: Record<string, unknown>, prefix: "firstUtm" | "lastUtm" | "utm"): UtmParams {
  const raw = (d[prefix] as Partial<UtmParams>) ?? {};
  return { ...EMPTY_UTM, ...raw };
}

function visitorFromDoc(doc: DocumentSnapshot): Visitor {
  const d = doc.data() ?? {};
  const pageViewCounts = (d.pageViewCounts as Record<string, number>) ?? {};
  const mostViewedPage =
    Object.entries(pageViewCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const totalSessions = (d.totalSessions as number) ?? 0;
  const totalSessionDurationSeconds = (d.totalSessionDurationSeconds as number) ?? 0;

  return {
    id: doc.id,
    fingerprintVisitorId: (d.fingerprintVisitorId as string) ?? null,
    legacyVisitorIds: Array.isArray(d.legacyVisitorIds) ? (d.legacyVisitorIds as string[]) : [],

    firstSeenAt: tsToIso(d.firstSeenAt) ?? new Date(0).toISOString(),
    lastSeenAt: tsToIso(d.lastSeenAt) ?? new Date(0).toISOString(),

    totalSessions,
    totalPageViews: (d.totalPageViews as number) ?? 0,
    totalEvents: (d.totalEvents as number) ?? 0,
    totalActiveSeconds: (d.totalActiveSeconds as number) ?? 0,
    totalSessionDurationSeconds,
    averageSessionSeconds: totalSessions > 0 ? Math.round(totalSessionDurationSeconds / totalSessions) : 0,

    firstLandingPage: (d.firstLandingPage as string) ?? null,
    lastLandingPage: (d.lastLandingPage as string) ?? null,
    lastPage: (d.lastPage as string) ?? null,
    mostViewedPage,
    pageViewCounts,

    firstReferrer: (d.firstReferrer as string) ?? null,
    lastReferrer: (d.lastReferrer as string) ?? null,
    firstReferrerType: (d.firstReferrerType as ReferrerType) ?? "unknown",
    lastReferrerType: (d.lastReferrerType as ReferrerType) ?? "unknown",

    firstUtm: utmFromData(d, "firstUtm"),
    lastUtm: utmFromData(d, "lastUtm"),

    country: (d.country as string) ?? null,
    countryCode: (d.countryCode as string) ?? null,
    region: (d.region as string) ?? null,
    city: (d.city as string) ?? null,
    timezone: (d.timezone as string) ?? null,
    locationSource: (d.locationSource as LocationSource) ?? "unknown",

    deviceType: (d.deviceType as DeviceType) ?? "unknown",
    browser: (d.browser as string) ?? null,
    browserVersion: (d.browserVersion as string) ?? null,
    operatingSystem: (d.operatingSystem as string) ?? null,
    osVersion: (d.osVersion as string) ?? null,
    screenWidth: (d.screenWidth as number) ?? null,
    screenHeight: (d.screenHeight as number) ?? null,
    language: (d.language as string) ?? null,

    isBot: Boolean(d.isBot),
    isVpn: Boolean(d.isVpn),
    isIncognito: Boolean(d.isIncognito),
    isProxy: Boolean(d.isProxy),
    confidenceScore: (d.confidenceScore as number) ?? null,

    status: (d.status as Visitor["status"]) ?? "anonymous",
    leadId: (d.leadId as string) ?? null,
    companyId: (d.companyId as string) ?? null,

    engagementScore: clampScore((d.engagementScore as number) ?? 0),
    intentScore: clampScore((d.intentScore as number) ?? 0),

    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? new Date(0).toISOString(),
  };
}

function sessionFromDoc(doc: DocumentSnapshot): VisitorSession {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    visitorId: (d.visitorId as string) ?? "",

    startedAt: tsToIso(d.startedAt) ?? new Date(0).toISOString(),
    lastActivityAt: tsToIso(d.lastActivityAt) ?? new Date(0).toISOString(),
    endedAt: tsToIso(d.endedAt),
    durationSeconds: (d.durationSeconds as number) ?? 0,
    activeSeconds: (d.activeSeconds as number) ?? 0,

    landingPage: (d.landingPage as string) ?? "",
    exitPage: (d.exitPage as string) ?? null,
    pageViews: (d.pageViews as number) ?? 0,
    eventCount: (d.eventCount as number) ?? 0,

    referrer: (d.referrer as string) ?? null,
    referrerDomain: (d.referrerDomain as string) ?? null,
    referrerType: (d.referrerType as ReferrerType) ?? "unknown",
    utm: utmFromData(d, "utm"),

    deviceType: (d.deviceType as DeviceType) ?? "unknown",
    browser: (d.browser as string) ?? null,
    operatingSystem: (d.operatingSystem as string) ?? null,

    country: (d.country as string) ?? null,
    region: (d.region as string) ?? null,
    city: (d.city as string) ?? null,

    isBounce: Boolean(d.isBounce),
    isEngaged: Boolean(d.isEngaged),
    engagementScore: clampScore((d.engagementScore as number) ?? 0),

    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? new Date(0).toISOString(),
  };
}

function eventFromDoc(doc: DocumentSnapshot): VisitorEvent {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    visitorId: (d.visitorId as string) ?? "",
    sessionId: (d.sessionId as string) ?? "",

    eventType: (d.eventType as EventType) ?? "click",
    eventName: (d.eventName as string) ?? null,

    pageUrl: (d.pageUrl as string) ?? null,
    pagePath: (d.pagePath as string) ?? null,
    pageTitle: (d.pageTitle as string) ?? null,

    timestamp: tsToIso(d.timestamp) ?? new Date(0).toISOString(),
    durationMs: (d.durationMs as number) ?? null,

    elementId: (d.elementId as string) ?? null,
    elementText: (d.elementText as string) ?? null,
    elementType: (d.elementType as string) ?? null,

    metadata: (d.metadata as Record<string, unknown>) ?? null,

    referrer: (d.referrer as string) ?? null,
    utm: utmFromData(d, "utm"),

    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface IdentifyInput {
  fingerprintVisitorId: string | null;
  confidenceScore?: number | null;
  isBot?: boolean;
  isVpn?: boolean;
  isIncognito?: boolean;
  isProxy?: boolean;
  deviceType?: DeviceType;
  browser?: string | null;
  browserVersion?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  language?: string | null;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  locationSource?: LocationSource;
  /** A pre-Fingerprint localStorage UUID from this same browser, if the client sent one — folded in via mergeLegacyVisitorId() rather than creating a second, disconnected record. */
  legacyVisitorId?: string | null;
}

/**
 * Upserts by fingerprintVisitorId — the trusted identifier, resolved
 * server-side via the Fingerprint Server API before this is ever called
 * (spec §3: never trust a client-supplied visitorId directly). Without a
 * fingerprintVisitorId (Fingerprint unavailable/blocked), the caller
 * should fall back to createAnonymousVisitor() instead so tracking still
 * degrades gracefully rather than failing outright (spec §28).
 */
export async function identifyVisitor(input: IdentifyInput): Promise<Visitor> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();

  let ref;
  if (input.fingerprintVisitorId) {
    const existing = await db
      .collection(VISITORS)
      .where("fingerprintVisitorId", "==", input.fingerprintVisitorId)
      .limit(1)
      .get();
    ref = existing.empty ? db.collection(VISITORS).doc() : existing.docs[0].ref;
  } else if (input.legacyVisitorId) {
    // Fingerprint unconfigured/unavailable (spec §28's graceful-degradation
    // path) — fall back to the pre-Fingerprint localStorage id so a
    // returning visitor on the same browser still resolves to the same
    // visitor doc instead of getting a fresh one on every identify() call.
    const existing = await db
      .collection(VISITORS)
      .where("legacyVisitorIds", "array-contains", input.legacyVisitorId)
      .limit(1)
      .get();
    ref = existing.empty ? db.collection(VISITORS).doc() : existing.docs[0].ref;
  } else {
    ref = db.collection(VISITORS).doc();
  }

  const doc = await ref.get();
  const patch: Record<string, unknown> = {
    fingerprintVisitorId: input.fingerprintVisitorId ?? null,
    confidenceScore: input.confidenceScore ?? null,
    isBot: input.isBot ?? false,
    isVpn: input.isVpn ?? false,
    isIncognito: input.isIncognito ?? false,
    isProxy: input.isProxy ?? false,
    deviceType: input.deviceType ?? "unknown",
    browser: input.browser ?? null,
    browserVersion: input.browserVersion ?? null,
    operatingSystem: input.operatingSystem ?? null,
    osVersion: input.osVersion ?? null,
    screenWidth: input.screenWidth ?? null,
    screenHeight: input.screenHeight ?? null,
    language: input.language ?? null,
    country: input.country ?? null,
    countryCode: input.countryCode ?? null,
    region: input.region ?? null,
    city: input.city ?? null,
    timezone: input.timezone ?? null,
    locationSource: input.locationSource ?? "unknown",
    lastSeenAt: now,
    updatedAt: now,
  };

  if (!doc.exists) {
    Object.assign(patch, {
      legacyVisitorIds: [],
      firstSeenAt: now,
      totalSessions: 0,
      totalPageViews: 0,
      totalEvents: 0,
      totalActiveSeconds: 0,
      totalSessionDurationSeconds: 0,
      firstLandingPage: null,
      lastLandingPage: null,
      lastPage: null,
      pageViewCounts: {},
      firstReferrer: null,
      lastReferrer: null,
      firstReferrerType: "unknown",
      lastReferrerType: "unknown",
      firstUtm: EMPTY_UTM,
      lastUtm: EMPTY_UTM,
      status: "anonymous",
      leadId: null,
      companyId: null,
      engagementScore: 0,
      intentScore: 0,
      createdAt: now,
    });
  }

  await ref.set(patch, { merge: true });
  if (input.legacyVisitorId) {
    await ref.update({ legacyVisitorIds: FieldValue.arrayUnion(input.legacyVisitorId) });
  }

  const fresh = await ref.get();
  return visitorFromDoc(fresh);
}

export interface SessionContext {
  landingPage: string;
  referrer: string | null;
  utm: UtmParams;
  deviceType: DeviceType;
  browser: string | null;
  operatingSystem: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
}

/**
 * Resumes clientSessionId if it's still within the inactivity window
 * (spec §5) and not already ended; otherwise starts a fresh session.
 * Every call refreshes the visitor's lastLandingPage/lastReferrer/lastUtm
 * (last-touch attribution) while leaving the first-touch fields alone
 * once set.
 */
export async function getOrStartSession(
  visitorId: string,
  clientSessionId: string | null,
  ctx: SessionContext
): Promise<VisitorSession> {
  const db = getAdminFirestore();

  if (clientSessionId) {
    const existingRef = db.collection(SESSIONS).doc(clientSessionId);
    const existing = await existingRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      const lastActivity = tsToIso(data.lastActivityAt);
      const stillActive =
        !data.endedAt && lastActivity && Date.now() - new Date(lastActivity).getTime() < SESSION_INACTIVITY_MS;
      if (stillActive) {
        await existingRef.update({ lastActivityAt: FieldValue.serverTimestamp() });
        return sessionFromDoc(await existingRef.get());
      }
    }
  }

  return startNewSession(visitorId, ctx);
}

async function startNewSession(visitorId: string, ctx: SessionContext): Promise<VisitorSession> {
  const db = getAdminFirestore();
  const visitorRef = db.collection(VISITORS).doc(visitorId);
  const visitorSnap = await visitorRef.get();
  const isReturning = ((visitorSnap.data()?.totalSessions as number) ?? 0) > 0;

  const referrerType = classifyReferrer(ctx.referrer, ctx.utm);
  const now = FieldValue.serverTimestamp();

  const sessionRef = await db.collection(SESSIONS).add({
    visitorId,
    startedAt: now,
    lastActivityAt: now,
    endedAt: null,
    durationSeconds: 0,
    activeSeconds: 0,
    landingPage: ctx.landingPage,
    exitPage: ctx.landingPage,
    pageViews: 0,
    eventCount: 0,
    referrer: ctx.referrer,
    referrerDomain: domainOf(ctx.referrer),
    referrerType,
    utm: ctx.utm,
    deviceType: ctx.deviceType,
    browser: ctx.browser,
    operatingSystem: ctx.operatingSystem,
    country: ctx.country,
    region: ctx.region,
    city: ctx.city,
    isBounce: false,
    isEngaged: false,
    engagementScore: 0,
    createdAt: now,
    updatedAt: now,
  });

  const visitorPatch: Record<string, unknown> = {
    totalSessions: FieldValue.increment(1),
    lastLandingPage: ctx.landingPage,
    lastReferrer: ctx.referrer,
    lastReferrerType: referrerType,
    lastUtm: ctx.utm,
    lastSeenAt: now,
    updatedAt: now,
  };
  if (!visitorSnap.data()?.firstLandingPage) {
    visitorPatch.firstLandingPage = ctx.landingPage;
    visitorPatch.firstReferrer = ctx.referrer;
    visitorPatch.firstReferrerType = referrerType;
    visitorPatch.firstUtm = ctx.utm;
  }
  if (isReturning) {
    visitorPatch.engagementScore = FieldValue.increment(RETURNING_SESSION_ENGAGEMENT_BONUS);
    visitorPatch.intentScore = FieldValue.increment(RETURNING_SESSION_INTENT_BONUS);
  }
  await visitorRef.update(visitorPatch);

  return sessionFromDoc(await sessionRef.get());
}

/** Spec §7 — heartbeat while the page is visible/active, `activeSecondsDelta` is the interval length (10-15s), never a running total, so repeated calls just accumulate correctly via FieldValue.increment. */
export async function recordHeartbeat(sessionId: string, visitorId: string, activeSecondsDelta: number): Promise<void> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  await Promise.all([
    db.collection(SESSIONS).doc(sessionId).update({
      activeSeconds: FieldValue.increment(activeSecondsDelta),
      lastActivityAt: now,
      updatedAt: now,
    }),
    db.collection(VISITORS).doc(visitorId).update({
      totalActiveSeconds: FieldValue.increment(activeSecondsDelta),
      lastSeenAt: now,
      updatedAt: now,
    }),
  ]);
}

export interface EndSessionInput {
  exitPage?: string | null;
  durationSeconds: number;
}

export async function endSession(sessionId: string, visitorId: string, input: EndSessionInput): Promise<void> {
  const db = getAdminFirestore();
  const sessionRef = db.collection(SESSIONS).doc(sessionId);
  const snap = await sessionRef.get();
  if (!snap.exists || snap.data()?.endedAt) return; // already ended — sendBeacon can double-fire

  const data = snap.data()!;
  const pageViews = (data.pageViews as number) ?? 0;
  const activeSeconds = (data.activeSeconds as number) ?? 0;
  const isBounce = pageViews <= 1 && input.durationSeconds < BOUNCE_MAX_DURATION_SECONDS;
  const isEngaged = activeSeconds >= ENGAGED_MIN_ACTIVE_SECONDS;
  const now = FieldValue.serverTimestamp();

  await sessionRef.update({
    endedAt: now,
    durationSeconds: input.durationSeconds,
    exitPage: input.exitPage ?? data.exitPage ?? null,
    isBounce,
    isEngaged,
    updatedAt: now,
  });

  await db.collection(VISITORS).doc(visitorId).update({
    totalSessionDurationSeconds: FieldValue.increment(input.durationSeconds),
    updatedAt: now,
  });
}

export interface RecordEventInput {
  visitorId: string;
  sessionId: string;
  eventType: EventType;
  eventName?: string | null;
  pageUrl?: string | null;
  pagePath?: string | null;
  pageTitle?: string | null;
  durationMs?: number | null;
  elementId?: string | null;
  elementText?: string | null;
  elementType?: string | null;
  metadata?: Record<string, unknown> | null;
  referrer?: string | null;
  utm?: UtmParams;
}

export async function recordEvent(input: RecordEventInput): Promise<VisitorEvent> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const utm = input.utm ?? EMPTY_UTM;

  const ref = await db.collection(EVENTS).add({
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    eventType: input.eventType,
    eventName: input.eventName ?? null,
    pageUrl: input.pageUrl ?? null,
    pagePath: input.pagePath ?? null,
    pageTitle: input.pageTitle ?? null,
    timestamp: now,
    durationMs: input.durationMs ?? null,
    elementId: input.elementId ?? null,
    elementText: input.elementText ?? null,
    elementType: input.elementType ?? null,
    metadata: input.metadata ?? null,
    referrer: input.referrer ?? null,
    utm,
    createdAt: now,
  });

  const engagementWeight = ENGAGEMENT_WEIGHTS[input.eventType] ?? 0;
  const intentWeight = INTENT_WEIGHTS[input.eventType] ?? 0;
  const isPageView = input.eventType === "page_view";

  const sessionPatch: Record<string, unknown> = { eventCount: FieldValue.increment(1), lastActivityAt: now, updatedAt: now };
  if (engagementWeight) sessionPatch.engagementScore = FieldValue.increment(engagementWeight);
  if (isPageView) {
    sessionPatch.pageViews = FieldValue.increment(1);
    if (input.pagePath) sessionPatch.exitPage = input.pagePath;
  }
  await db.collection(SESSIONS).doc(input.sessionId).update(sessionPatch);

  const visitorPatch: Record<string, unknown> = { totalEvents: FieldValue.increment(1), lastSeenAt: now, updatedAt: now };
  if (engagementWeight) visitorPatch.engagementScore = FieldValue.increment(engagementWeight);
  if (intentWeight) visitorPatch.intentScore = FieldValue.increment(intentWeight);
  if (isPageView && input.pagePath) {
    visitorPatch.totalPageViews = FieldValue.increment(1);
    visitorPatch.lastPage = input.pagePath;
  }
  await db.collection(VISITORS).doc(input.visitorId).update(visitorPatch);

  // Separate, precisely-typed call for the nested map-field increment —
  // FieldPath treats pagePath as one literal path segment regardless of
  // any '.'/'/' characters it contains, avoiding the dot-notation
  // ambiguity a plain "pageViewCounts.<path>" string key would risk.
  if (isPageView && input.pagePath) {
    await db
      .collection(VISITORS)
      .doc(input.visitorId)
      .update(new FieldPath("pageViewCounts", input.pagePath), FieldValue.increment(1));
  }

  return eventFromDoc(await ref.get());
}

export interface ListVisitorsFilters {
  limit?: number;
  status?: Visitor["status"];
  country?: string;
  minIntentScore?: number;
}

/** In-memory filtering, same composite-index-avoidance pattern as crm.ts's listCompanies(). */
export async function listVisitors(filters: ListVisitorsFilters = {}): Promise<Visitor[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(VISITORS).orderBy("lastSeenAt", "desc").limit(filters.limit ?? 500).get();
  let visitors = snapshot.docs.map(visitorFromDoc);

  if (filters.status) visitors = visitors.filter((v) => v.status === filters.status);
  if (filters.country) visitors = visitors.filter((v) => v.country === filters.country);
  if (filters.minIntentScore !== undefined) visitors = visitors.filter((v) => v.intentScore >= filters.minIntentScore!);

  return visitors;
}

export async function getVisitor(id: string): Promise<Visitor | null> {
  const doc = await getAdminFirestore().collection(VISITORS).doc(id).get();
  return doc.exists ? visitorFromDoc(doc) : null;
}

export interface VisitorTimelineEntry {
  kind: "session_start" | "session_end" | "event";
  timestamp: string;
  session?: VisitorSession;
  event?: VisitorEvent;
}

/** Spec §19 — a single chronological feed merging session boundaries and events for one visitor. */
export async function getVisitorTimeline(visitorId: string, limit = 200): Promise<VisitorTimelineEntry[]> {
  const db = getAdminFirestore();
  const [sessionsSnap, eventsSnap] = await Promise.all([
    db.collection(SESSIONS).where("visitorId", "==", visitorId).limit(200).get(),
    db.collection(EVENTS).where("visitorId", "==", visitorId).limit(limit).get(),
  ]);

  const entries: VisitorTimelineEntry[] = [];
  for (const doc of sessionsSnap.docs) {
    const session = sessionFromDoc(doc);
    entries.push({ kind: "session_start", timestamp: session.startedAt, session });
    if (session.endedAt) entries.push({ kind: "session_end", timestamp: session.endedAt, session });
  }
  for (const doc of eventsSnap.docs) {
    const event = eventFromDoc(doc);
    entries.push({ kind: "event", timestamp: event.timestamp, event });
  }

  return entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit);
}

export async function listSessionsForVisitor(visitorId: string): Promise<VisitorSession[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(SESSIONS).where("visitorId", "==", visitorId).limit(200).get();
  return snapshot.docs.map(sessionFromDoc).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

/** Spec §18/§38 — called once a visitor legitimately identifies themselves via a form submission. */
export async function linkVisitorToLead(visitorId: string, leadId: string): Promise<void> {
  await getAdminFirestore().collection(VISITORS).doc(visitorId).update({
    status: "identified",
    leadId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const PAGEVIEWS = "pageviews"; // the legacy, pre-Visitor-Intelligence collection — read-only from here on, never written to by any code in this project anymore.

export interface BackfillResult {
  pageviewsScanned: number;
  visitorsCreated: number;
  visitorsMerged: number;
}

interface LegacyPageview {
  path: string;
  referrer: string | null;
  createdAtIso: string;
  docRef: FirebaseFirestore.DocumentReference;
}

/**
 * Spec §40 — idempotent, on-demand migration of the legacy `pageviews`
 * collection into real `visitors` records. Same "mark-as-processed
 * instead of a Cloud Function trigger" idempotency pattern as crm.ts's
 * syncLeadsToCompanies() — a `backfilledToVisitorId` marker on each
 * pageview doc means re-running only picks up rows this hasn't seen
 * before. Never deletes or overwrites the original pageviews docs'
 * core fields (spec §40's "preserve historical data").
 *
 * If a visitor already exists for a given legacy id (the live pipeline
 * already saw this browser via identify()'s legacyVisitorId fallback),
 * this only ever widens totals/first-touch fields backward in time —
 * never touches the visitor's "last" / most-recent fields, since the
 * live pipeline's own data is always more current than a historical
 * pageview backfill.
 */
export async function backfillVisitorsFromPageviews(limit = 5000): Promise<BackfillResult> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(PAGEVIEWS).limit(limit).get();

  const groups = new Map<string, LegacyPageview[]>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.backfilledToVisitorId) continue;
    const legacyId = data.visitorId as string | undefined;
    const createdAtIso = tsToIso(data.createdAt);
    if (!legacyId || !createdAtIso) continue;
    const entry: LegacyPageview = {
      path: (data.path as string) ?? "unknown",
      referrer: (data.referrer as string) ?? null,
      createdAtIso,
      docRef: doc.ref,
    };
    if (!groups.has(legacyId)) groups.set(legacyId, []);
    groups.get(legacyId)!.push(entry);
  }

  let visitorsCreated = 0;
  let visitorsMerged = 0;

  for (const [legacyId, entries] of groups) {
    entries.sort((a, b) => (a.createdAtIso < b.createdAtIso ? -1 : 1));
    const first = entries[0];
    const last = entries[entries.length - 1];
    const pageViewCounts: Record<string, number> = {};
    for (const e of entries) pageViewCounts[e.path] = (pageViewCounts[e.path] ?? 0) + 1;

    const existing = await db.collection(VISITORS).where("legacyVisitorIds", "array-contains", legacyId).limit(1).get();
    const now = FieldValue.serverTimestamp();
    let visitorRef: FirebaseFirestore.DocumentReference;

    if (existing.empty) {
      visitorRef = db.collection(VISITORS).doc();
      await visitorRef.set({
        fingerprintVisitorId: null,
        legacyVisitorIds: [legacyId],
        firstSeenAt: Timestamp.fromDate(new Date(first.createdAtIso)),
        lastSeenAt: Timestamp.fromDate(new Date(last.createdAtIso)),
        totalSessions: 0,
        totalPageViews: entries.length,
        totalEvents: 0,
        totalActiveSeconds: 0,
        totalSessionDurationSeconds: 0,
        firstLandingPage: first.path,
        lastLandingPage: last.path,
        lastPage: last.path,
        pageViewCounts,
        firstReferrer: first.referrer,
        lastReferrer: last.referrer,
        firstReferrerType: classifyReferrer(first.referrer, EMPTY_UTM),
        lastReferrerType: classifyReferrer(last.referrer, EMPTY_UTM),
        firstUtm: EMPTY_UTM,
        lastUtm: EMPTY_UTM,
        country: null,
        countryCode: null,
        region: null,
        city: null,
        timezone: null,
        locationSource: "unknown",
        deviceType: "unknown",
        browser: null,
        browserVersion: null,
        operatingSystem: null,
        osVersion: null,
        screenWidth: null,
        screenHeight: null,
        language: null,
        isBot: false,
        isVpn: false,
        isIncognito: false,
        isProxy: false,
        confidenceScore: null,
        status: "anonymous",
        leadId: null,
        companyId: null,
        engagementScore: 0,
        intentScore: 0,
        createdAt: now,
        updatedAt: now,
      });
      visitorsCreated++;
    } else {
      visitorRef = existing.docs[0].ref;
      const existingData = existing.docs[0].data();
      const existingFirstSeen = tsToIso(existingData.firstSeenAt);
      const patch: Record<string, unknown> = {
        totalPageViews: FieldValue.increment(entries.length),
        updatedAt: now,
      };
      if (!existingFirstSeen || first.createdAtIso < existingFirstSeen) {
        patch.firstSeenAt = Timestamp.fromDate(new Date(first.createdAtIso));
        patch.firstLandingPage = first.path;
        patch.firstReferrer = first.referrer;
        patch.firstReferrerType = classifyReferrer(first.referrer, EMPTY_UTM);
      }
      await visitorRef.update(patch);
      for (const [path, count] of Object.entries(pageViewCounts)) {
        await visitorRef.update(new FieldPath("pageViewCounts", path), FieldValue.increment(count));
      }
      visitorsMerged++;
    }

    await Promise.all(entries.map((e) => e.docRef.update({ backfilledToVisitorId: visitorRef.id })));
  }

  return { pageviewsScanned: snapshot.size, visitorsCreated, visitorsMerged };
}

export interface GeographyCityRow {
  city: string;
  visitorCount: number;
  sessionCount: number;
  avgEngagement: number;
  highIntentCount: number;
}

export interface GeographyCountryRow {
  country: string;
  countryCode: string | null;
  visitorCount: number;
  sessionCount: number;
  avgEngagement: number;
  highIntentCount: number;
  demoRequestCount: number;
  cities: GeographyCityRow[];
}

/**
 * Spec §14/§16/§17 — a table-first geographic breakdown (spec §16 itself
 * prefers a heatmap/cluster view over "thousands of individual markers";
 * a country/city table is the same spirit without needing a Google Maps
 * API key at all, which this project doesn't have configured yet). No
 * hardcoded Zambian city list (spec §17) — cities fall out naturally from
 * whichever real visitor data exists.
 *
 * Grounded in `visitors` (each carrying its own most-recently-known
 * location) rather than `visitorSessions`, filtered by lastSeenAt within
 * the window — a deliberate v1 simplification: a per-session/per-event
 * geographic breakdown would need every VisitorEvent to carry its own
 * country/city (it doesn't, only Visitor/VisitorSession do), so "visitor
 * was active in this window" is the practical unit here, not "session
 * happened in this window". Demo/contact-request counts are the one
 * exception — those come from a real visitorEvents query, joined back to
 * each visitor's location.
 */
export async function getGeographyBreakdown(sinceIso: string | null): Promise<GeographyCountryRow[]> {
  const db = getAdminFirestore();
  const allVisitors = await listVisitors({ limit: 3000 });
  const visitors = sinceIso ? allVisitors.filter((v) => v.lastSeenAt >= sinceIso) : allVisitors;
  const visitorById = new Map(allVisitors.map((v) => [v.id, v]));

  const conversionEventsSnap = await db
    .collection(EVENTS)
    .where("eventType", "in", ["demo_request", "contact_request"])
    .limit(3000)
    .get();
  const demoCountByCountry = new Map<string, number>();
  for (const doc of conversionEventsSnap.docs) {
    const data = doc.data();
    const ts = tsToIso(data.timestamp);
    if (sinceIso && (!ts || ts < sinceIso)) continue;
    const visitor = visitorById.get(data.visitorId as string);
    const country = visitor?.country ?? "Unknown";
    demoCountByCountry.set(country, (demoCountByCountry.get(country) ?? 0) + 1);
  }

  const countryGroups = new Map<string, { countryCode: string | null; visitors: Visitor[]; cityGroups: Map<string, Visitor[]> }>();
  for (const v of visitors) {
    const country = v.country ?? "Unknown";
    if (!countryGroups.has(country)) countryGroups.set(country, { countryCode: v.countryCode, visitors: [], cityGroups: new Map() });
    const group = countryGroups.get(country)!;
    group.visitors.push(v);
    if (!group.countryCode && v.countryCode) group.countryCode = v.countryCode;

    const city = v.city ?? "Unknown";
    if (!group.cityGroups.has(city)) group.cityGroups.set(city, []);
    group.cityGroups.get(city)!.push(v);
  }

  const averageEngagement = (vs: Visitor[]): number =>
    vs.length ? Math.round(vs.reduce((sum, v) => sum + v.engagementScore, 0) / vs.length) : 0;
  const highIntentCount = (vs: Visitor[]): number =>
    vs.filter((v) => intentCategory(v.intentScore) === "high-intent" || intentCategory(v.intentScore) === "sales-ready").length;

  const rows: GeographyCountryRow[] = [];
  for (const [country, group] of countryGroups) {
    const cities: GeographyCityRow[] = [...group.cityGroups.entries()]
      .map(([city, vs]) => ({
        city,
        visitorCount: vs.length,
        sessionCount: vs.reduce((sum, v) => sum + v.totalSessions, 0),
        avgEngagement: averageEngagement(vs),
        highIntentCount: highIntentCount(vs),
      }))
      .sort((a, b) => b.visitorCount - a.visitorCount);

    rows.push({
      country,
      countryCode: group.countryCode,
      visitorCount: group.visitors.length,
      sessionCount: group.visitors.reduce((sum, v) => sum + v.totalSessions, 0),
      avgEngagement: averageEngagement(group.visitors),
      highIntentCount: highIntentCount(group.visitors),
      demoRequestCount: demoCountByCountry.get(country) ?? 0,
      cities,
    });
  }

  return rows.sort((a, b) => b.visitorCount - a.visitorCount);
}

const CONTENT_FETCH_LIMIT = 5000;

export type ContentClassification =
  | "traffic-winner"
  | "engagement-winner"
  | "conversion-winner"
  | "high-bounce"
  | "low-traffic-high-conversion";

export interface ContentPerformanceRow {
  pagePath: string;
  views: number;
  uniqueVisitors: number;
  sessionsAsLanding: number;
  bounceRate: number | null;
  avgEngagement: number | null;
  conversions: number;
  conversionRate: number | null;
  classifications: ContentClassification[];
}

/**
 * Spec §13/§24 — per-page performance, deterministic first (spec §35's
 * "do not use AI for basic arithmetic"). Three separate bounded fetches
 * joined by pagePath in memory, same composite-index-avoidance pattern
 * as everywhere else in this file:
 * - page_view events -> views, unique visitors
 * - sessions -> landing-page bounce rate, average engagement (a page's
 *   own quality as an *entry point*, not just traffic to it)
 * - conversion events (spec's CONVERSION_EVENT_TYPES) -> conversions,
 *   conversion rate
 *
 * Classification thresholds (top-3 by views/engagement/conversion rate,
 * >60% bounce, below-median views with above-median conversion rate) are
 * simple and tunable, not hidden inside the UI — spec §24's own label
 * set, minus "SEO Opportunity" (would need organic-only traffic
 * segmentation per page, which needs every event to carry its session's
 * referrerType — only VisitorSession does today, not VisitorEvent — not
 * built this pass).
 */
export async function getContentPerformance(): Promise<ContentPerformanceRow[]> {
  const db = getAdminFirestore();

  const [pageViewsSnap, sessionsSnap, conversionsSnap] = await Promise.all([
    db.collection(EVENTS).where("eventType", "==", "page_view").limit(CONTENT_FETCH_LIMIT).get(),
    db.collection(SESSIONS).limit(CONTENT_FETCH_LIMIT).get(),
    db.collection(EVENTS).where("eventType", "in", CONVERSION_EVENT_TYPES).limit(CONTENT_FETCH_LIMIT).get(),
  ]);

  const viewsByPath = new Map<string, { count: number; visitors: Set<string> }>();
  for (const doc of pageViewsSnap.docs) {
    const d = doc.data();
    const path = (d.pagePath as string) ?? "unknown";
    if (!viewsByPath.has(path)) viewsByPath.set(path, { count: 0, visitors: new Set() });
    const entry = viewsByPath.get(path)!;
    entry.count++;
    if (d.visitorId) entry.visitors.add(d.visitorId as string);
  }

  const landingByPath = new Map<string, { sessions: number; bounces: number; engagementSum: number }>();
  for (const doc of sessionsSnap.docs) {
    const d = doc.data();
    const path = (d.landingPage as string) ?? "unknown";
    if (!landingByPath.has(path)) landingByPath.set(path, { sessions: 0, bounces: 0, engagementSum: 0 });
    const entry = landingByPath.get(path)!;
    entry.sessions++;
    if (d.isBounce) entry.bounces++;
    entry.engagementSum += (d.engagementScore as number) ?? 0;
  }

  const conversionsByPath = new Map<string, number>();
  for (const doc of conversionsSnap.docs) {
    const d = doc.data();
    const path = (d.pagePath as string) ?? "unknown";
    conversionsByPath.set(path, (conversionsByPath.get(path) ?? 0) + 1);
  }

  const allPaths = new Set([...viewsByPath.keys(), ...landingByPath.keys(), ...conversionsByPath.keys()]);
  const rows: ContentPerformanceRow[] = [...allPaths].map((pagePath) => {
    const viewEntry = viewsByPath.get(pagePath);
    const landingEntry = landingByPath.get(pagePath);
    const conversions = conversionsByPath.get(pagePath) ?? 0;
    const views = viewEntry?.count ?? 0;

    return {
      pagePath,
      views,
      uniqueVisitors: viewEntry?.visitors.size ?? 0,
      sessionsAsLanding: landingEntry?.sessions ?? 0,
      bounceRate: landingEntry && landingEntry.sessions > 0 ? landingEntry.bounces / landingEntry.sessions : null,
      avgEngagement: landingEntry && landingEntry.sessions > 0 ? Math.round(landingEntry.engagementSum / landingEntry.sessions) : null,
      conversions,
      conversionRate: views > 0 ? conversions / views : null,
      classifications: [],
    };
  });

  classifyContentRows(rows);
  return rows.sort((a, b) => b.views - a.views);
}

function classifyContentRows(rows: ContentPerformanceRow[]): void {
  if (rows.length === 0) return;
  const TOP_N = 3;
  const MIN_VIEWS_FOR_CONVERSION_RANKING = 5;
  const MIN_SESSIONS_FOR_BOUNCE = 3;

  const byViews = [...rows].sort((a, b) => b.views - a.views).slice(0, TOP_N);
  for (const row of byViews) if (row.views > 0) row.classifications.push("traffic-winner");

  const byEngagement = [...rows]
    .filter((r) => r.avgEngagement !== null && r.sessionsAsLanding > 0)
    .sort((a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0))
    .slice(0, TOP_N);
  for (const row of byEngagement) row.classifications.push("engagement-winner");

  const byConversion = [...rows]
    .filter((r) => r.views >= MIN_VIEWS_FOR_CONVERSION_RANKING && r.conversionRate !== null)
    .sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0))
    .slice(0, TOP_N);
  for (const row of byConversion) if ((row.conversionRate ?? 0) > 0) row.classifications.push("conversion-winner");

  for (const row of rows) {
    if (row.sessionsAsLanding >= MIN_SESSIONS_FOR_BOUNCE && (row.bounceRate ?? 0) > 0.6) {
      row.classifications.push("high-bounce");
    }
  }

  const viewsSorted = [...rows.map((r) => r.views)].sort((a, b) => a - b);
  const conversionRatesSorted = rows
    .map((r) => r.conversionRate)
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b);
  const medianViews = viewsSorted[Math.floor(viewsSorted.length / 2)] ?? 0;
  const medianConversionRate = conversionRatesSorted[Math.floor(conversionRatesSorted.length / 2)] ?? 0;
  for (const row of rows) {
    if (row.views > 0 && row.views < medianViews && (row.conversionRate ?? 0) > medianConversionRate && (row.conversionRate ?? 0) > 0) {
      row.classifications.push("low-traffic-high-conversion");
    }
  }
}

export interface CampaignRow {
  channel: string;
  sessions: number;
  visitors: number;
  engagedSessions: number;
  highIntentVisitors: number;
  conversions: number;
  conversionRate: number | null;
}

/** Spec §11's first/last-touch distinction, simplified to session-level attribution here — one row per channel a session actually landed through, not per visitor's lifetime first/last touch (that's already on the Visitor doc itself, shown in the Visitors tab's Acquisition section). */
function channelKey(utmSource: string | null, utmCampaign: string | null, referrerType: ReferrerType): string {
  if (utmCampaign) return `${utmSource ?? referrerType} — ${utmCampaign}`;
  return referrerType;
}

/**
 * Spec §11/§34 — campaign/source performance, joined against real
 * conversion events via each event's own sessionId (more precise than
 * the country-level join in getGeographyBreakdown(), since sessions
 * carry an id events can reference directly).
 */
export async function getCampaignPerformance(): Promise<CampaignRow[]> {
  const db = getAdminFirestore();
  const [sessionsSnap, conversionsSnap, visitors] = await Promise.all([
    db.collection(SESSIONS).limit(CONTENT_FETCH_LIMIT).get(),
    db.collection(EVENTS).where("eventType", "in", CONVERSION_EVENT_TYPES).limit(CONTENT_FETCH_LIMIT).get(),
    listVisitors({ limit: 3000 }),
  ]);

  const intentByVisitorId = new Map(visitors.map((v) => [v.id, v.intentScore]));

  const sessionToChannel = new Map<string, string>();
  const groups = new Map<string, { sessions: number; visitorIds: Set<string>; engagedSessions: number; conversions: number }>();

  for (const doc of sessionsSnap.docs) {
    const d = doc.data();
    const utm = (d.utm as { utmSource?: string | null; utmCampaign?: string | null }) ?? {};
    const channel = channelKey(utm.utmSource ?? null, utm.utmCampaign ?? null, (d.referrerType as ReferrerType) ?? "unknown");
    sessionToChannel.set(doc.id, channel);

    if (!groups.has(channel)) groups.set(channel, { sessions: 0, visitorIds: new Set(), engagedSessions: 0, conversions: 0 });
    const group = groups.get(channel)!;
    group.sessions++;
    if (d.visitorId) group.visitorIds.add(d.visitorId as string);
    if (d.isEngaged) group.engagedSessions++;
  }

  for (const doc of conversionsSnap.docs) {
    const d = doc.data();
    const channel = sessionToChannel.get(d.sessionId as string);
    if (channel && groups.has(channel)) groups.get(channel)!.conversions++;
  }

  const rows: CampaignRow[] = [...groups.entries()].map(([channel, g]) => ({
    channel,
    sessions: g.sessions,
    visitors: g.visitorIds.size,
    engagedSessions: g.engagedSessions,
    highIntentVisitors: [...g.visitorIds].filter((id) => {
      const score = intentByVisitorId.get(id) ?? 0;
      return intentCategory(score) === "high-intent" || intentCategory(score) === "sales-ready";
    }).length,
    conversions: g.conversions,
    conversionRate: g.sessions > 0 ? g.conversions / g.sessions : null,
  }));

  return rows.sort((a, b) => b.sessions - a.sessions);
}

export interface FunnelSummary {
  totalVisitors: number;
  visitorsWithSession: number;
  engagedVisitors: number;
  convertedVisitors: number;
  identifiedVisitors: number;
}

/**
 * Spec §34's revenue-progression funnel, adapted to this marketing
 * site's actual vocabulary (no pipeline stages exist here the way the
 * DeployFleet CRM has — this is a website, not a sales pipeline):
 * Visitors -> had a real session -> engaged (spec §8's "engaged" band,
 * score >= 40) -> converted (fired at least one real conversion event) ->
 * identified (became a lead, spec §18/§38).
 */
export async function getFunnelSummary(): Promise<FunnelSummary> {
  const db = getAdminFirestore();
  const [visitors, conversionsSnap] = await Promise.all([
    listVisitors({ limit: 3000 }),
    db.collection(EVENTS).where("eventType", "in", CONVERSION_EVENT_TYPES).limit(CONTENT_FETCH_LIMIT).get(),
  ]);

  const convertedVisitorIds = new Set(conversionsSnap.docs.map((doc) => doc.data().visitorId as string).filter(Boolean));

  return {
    totalVisitors: visitors.length,
    visitorsWithSession: visitors.filter((v) => v.totalSessions > 0).length,
    engagedVisitors: visitors.filter((v) => v.engagementScore >= 40).length,
    convertedVisitors: visitors.filter((v) => convertedVisitorIds.has(v.id)).length,
    identifiedVisitors: visitors.filter((v) => v.status === "identified").length,
  };
}

const ACTIVE_WINDOW_MINUTES = 5;

/**
 * Spec §25 — "active visitors now." Polling-based, not a websocket/SSE
 * push (this project has no persistent-connection infra — Vercel
 * serverless functions and Firestore don't offer one without adding a
 * new piece of infrastructure) — the Real-Time page's own client polls
 * this on an interval instead. "Active" means a heartbeat/event landed
 * within the last 5 minutes, the same window session-continuity already
 * uses elsewhere (SESSION_INACTIVITY_MS is 30 min; this is deliberately
 * tighter, since "active now" should mean genuinely recent, not merely
 * "still within the same session").
 */
export async function getActiveVisitors(): Promise<Visitor[]> {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const visitors = await listVisitors({ limit: 200 });
  return visitors.filter((v) => v.lastSeenAt >= cutoff);
}

export interface AlertItem {
  id: string;
  severity: "info" | "notice" | "high";
  title: string;
  detail: string;
}

const ALERT_WINDOW_HOURS = 24;
const HIGH_INTENT_THRESHOLD_CATEGORIES = new Set(["high-intent", "sales-ready"]);
const REPEAT_VISITOR_SESSION_THRESHOLD = 3;

/**
 * Spec §37 — a computed alerts feed, not push notifications. Rendered
 * fresh on every page visit rather than delivered (email/Slack/webhook)
 * — real delivery needs a background job scheduler and a notification
 * channel (Resend/SendGrid, a Slack webhook, etc.), neither of which
 * exists in this project; Vercel Cron could drive a daily digest later,
 * but that's a real infrastructure decision to make deliberately, not
 * something to bolt on silently inside this function.
 */
export async function getAlerts(): Promise<AlertItem[]> {
  const db = getAdminFirestore();
  const since = new Date(Date.now() - ALERT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const alerts: AlertItem[] = [];

  const visitors = await listVisitors({ limit: 500 });

  const highIntentRecent = visitors.filter(
    (v) => v.lastSeenAt >= since && HIGH_INTENT_THRESHOLD_CATEGORIES.has(intentCategory(v.intentScore))
  );
  if (highIntentRecent.length > 0) {
    alerts.push({
      id: "high-intent-recent",
      severity: "high",
      title: `${highIntentRecent.length} high-intent visitor${highIntentRecent.length === 1 ? "" : "s"} in the last 24h`,
      detail: highIntentRecent
        .slice(0, 5)
        .map((v) => `${v.city ?? v.country ?? "Unknown location"} (intent ${v.intentScore})`)
        .join(", "),
    });
  }

  const repeatVisitors = visitors.filter((v) => v.totalSessions >= REPEAT_VISITOR_SESSION_THRESHOLD);
  if (repeatVisitors.length > 0) {
    alerts.push({
      id: "repeat-visitors",
      severity: "notice",
      title: `${repeatVisitors.length} visitor${repeatVisitors.length === 1 ? "" : "s"} have returned ${REPEAT_VISITOR_SESSION_THRESHOLD}+ times`,
      detail: repeatVisitors
        .slice(0, 5)
        .map((v) => `${v.city ?? v.country ?? "Unknown location"} (${v.totalSessions} sessions)`)
        .join(", "),
    });
  }

  // Two broad, unfiltered fetches (page_view; conversion types) with
  // in-memory filtering by pagePath/time — the same composite-index
  // avoidance as every other query in this file. A .where("pagePath",
  // "==", ...) alongside .where("eventType", "==", ...) would need a
  // manual composite index, which this project deliberately avoids.
  const [pageViewsSnap, conversionsSnap] = await Promise.all([
    db.collection(EVENTS).where("eventType", "==", "page_view").limit(CONTENT_FETCH_LIMIT).get(),
    db.collection(EVENTS).where("eventType", "in", CONVERSION_EVENT_TYPES).limit(CONTENT_FETCH_LIMIT).get(),
  ]);

  const pricingViewsToday = pageViewsSnap.docs.filter((doc) => {
    const d = doc.data();
    const ts = tsToIso(d.timestamp);
    return d.pagePath === "/pricing" && ts && ts >= since;
  }).length;
  if (pricingViewsToday > 0) {
    alerts.push({
      id: "pricing-views-today",
      severity: "info",
      title: `Pricing page viewed ${pricingViewsToday} time${pricingViewsToday === 1 ? "" : "s"} in the last 24h`,
      detail: "",
    });
  }

  const conversionsToday = conversionsSnap.docs.filter((doc) => {
    const ts = tsToIso(doc.data().timestamp);
    return ts && ts >= since;
  }).length;
  if (conversionsToday > 0) {
    alerts.push({
      id: "conversions-today",
      severity: "high",
      title: `${conversionsToday} conversion event${conversionsToday === 1 ? "" : "s"} in the last 24h`,
      detail: "",
    });
  }

  return alerts;
}
