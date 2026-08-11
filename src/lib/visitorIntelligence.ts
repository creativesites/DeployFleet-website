import "server-only";
import { FieldPath, FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin";
import { ENGAGEMENT_WEIGHTS, INTENT_WEIGHTS, RETURNING_SESSION_ENGAGEMENT_BONUS, RETURNING_SESSION_INTENT_BONUS, clampScore } from "./analytics/scoring";
import {
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
