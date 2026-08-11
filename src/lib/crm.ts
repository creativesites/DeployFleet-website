import "server-only";
import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin";
import { classifyZambianPhone } from "./phoneRules";
import { PROSPECT_SEED_ROWS } from "./prospectSeedData";
import { invalidateEmployeeContext, invalidateGlobalContext, invalidateProspectContext } from "./ai/contextCache";
import type {
  AiEmployee,
  AiEmployeeStatus,
  AuditEvent,
  AuditEventActor,
  AuditEventType,
  Campaign,
  CampaignStatus,
  Decision,
  DecisionScope,
  DecisionStatus,
  EmailSend,
  EmailSendStatus,
  EmailTemplateKey,
  Fact,
  FactLifecycleStatus,
  FactType,
  ExtractionResult,
  ExtractionStatus,
  InboxEntry,
  InboxSourceType,
  Interaction,
  InteractionOutcome,
  InteractionType,
  PipelineStage,
  PhoneClassification,
  Prospect,
  ProspectIntelligence,
  ProspectSource,
  Task,
  TaskCreatedBy,
  TaskIncompleteReason,
  TaskPriority,
  TaskStatus,
  VisitorSnapshot,
} from "./crmTypes";

/**
 * DeployFleet's own Revenue OS — Admin-SDK CRUD for the `prospects`/
 * `interactions` collections, the internal sales pipeline distinct from
 * Visitor Intelligence 2.0 (visitorIntelligence.ts), which is about
 * website visitors, not DeployFleet's own outbound/inbound deals. Same
 * "fetch broadly, filter in memory" composite-index-avoidance discipline
 * as every other lib file in this project.
 */

const PROSPECTS = "prospects";
const INTERACTIONS = "interactions";
const LEADS = "leads";
const VISITORS = "visitors";
const CAMPAIGNS = "campaigns";
const FACTS = "facts";
const TASKS = "tasks";
const DECISIONS = "decisions";
const AI_EMPLOYEES = "aiEmployees";
const AUDIT_EVENTS = "auditEvents";
const INBOX_ENTRIES = "inboxEntries";
const EMAIL_SENDS = "emailSends";

/** The Sales Playbook's own "up to 20 a day" cap (Winston's explicit instruction, see docs/ai-marketing-os-architecture.md §12) — enforced here, server-side, never trusted to the client. */
export const DAILY_EMAIL_CAP = 20;

/** Phase 0 §6.2's Weekly Targets — the Sales Playbook's own "10 attempts, 5 meaningful interactions" daily benchmark. A tunable constant, not a database-backed setting, same "not worth the complexity yet" choice Visitor Intelligence's scoring.ts already made for its own weight tables. */
const TARGET_ATTEMPTS_PER_DAY = 10;
const TARGET_MEANINGFUL_PER_DAY = 5;

/** Which InteractionOutcomes count as "meaningful" per the Sales Playbook's own attempted-vs-meaningful distinction (crmTypes.ts's own InteractionOutcome doc comment). */
const MEANINGFUL_OUTCOMES = new Set<InteractionOutcome>(["right-person", "meaningful-conversation", "demo-booked"]);

function tsToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function prospectFromDoc(doc: DocumentSnapshot): Prospect {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    name: (d.name as string) ?? "",
    contactName: (d.contactName as string) ?? null,
    contactRole: (d.contactRole as string) ?? null,
    contactPhone: (d.contactPhone as string) ?? null,
    contactWhatsapp: (d.contactWhatsapp as string) ?? null,
    contactEmail: (d.contactEmail as string) ?? null,
    location: (d.location as string) ?? null,
    estimatedFleetSizeRaw: (d.estimatedFleetSizeRaw as string) ?? null,
    primaryPainRaw: (d.primaryPainRaw as string) ?? null,
    phoneClassification: (d.phoneClassification as PhoneClassification) ?? null,
    source: (d.source as ProspectSource) ?? "other",
    stage: ((d.stage as number) ?? 0) as PipelineStage,
    lastInteractionOutcome: (d.lastInteractionOutcome as InteractionOutcome) ?? null,
    lastInteractionSummary: (d.lastInteractionSummary as string) ?? null,
    lastContactDate: (d.lastContactDate as string) ?? null,
    nextActionDate: (d.nextActionDate as string) ?? null,
    nextActionType: (d.nextActionType as InteractionType) ?? null,
    nextActionNote: (d.nextActionNote as string) ?? null,
    priorityScore: (d.priorityScore as number) ?? null,
    intelligence: (d.intelligence as ProspectIntelligence) ?? {},
    linkedLeadId: (d.linkedLeadId as string) ?? null,
    linkedVisitorId: (d.linkedVisitorId as string) ?? null,
    visitorSnapshot: (d.visitorSnapshot as VisitorSnapshot) ?? null,
    campaignId: (d.campaignId as string) ?? null,
    icpFitScore: (d.icpFitScore as number) ?? null,
    opportunityScore: (d.opportunityScore as number) ?? null,
    riskFlags: Array.isArray(d.riskFlags) ? (d.riskFlags as string[]) : [],
    flags: Array.isArray(d.flags) ? (d.flags as string[]) : [],
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    archivedAt: tsToIso(d.archivedAt),
  };
}

function interactionFromDoc(doc: DocumentSnapshot): Interaction {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    type: (d.type as InteractionType) ?? "note",
    outcome: (d.outcome as InteractionOutcome) ?? null,
    rawNote: (d.rawNote as string) ?? null,
    aiExtracted: (d.aiExtracted as Interaction["aiExtracted"]) ?? null,
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    createdBy: (d.createdBy as string) ?? "Unknown",
  };
}

export interface ListProspectsFilters {
  stage?: PipelineStage;
  source?: ProspectSource;
  includeArchived?: boolean;
  /** Only prospects whose nextActionDate is on or before this ISO date (YYYY-MM-DD) — the Today tab's query. */
  dueBy?: string;
  campaignId?: string;
}

export async function listProspects(filters: ListProspectsFilters = {}): Promise<Prospect[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(PROSPECTS).orderBy("createdAt", "desc").limit(1000).get();
  let prospects = snapshot.docs.map(prospectFromDoc);

  if (!filters.includeArchived) prospects = prospects.filter((p) => !p.archivedAt);
  if (filters.stage !== undefined) prospects = prospects.filter((p) => p.stage === filters.stage);
  if (filters.source) prospects = prospects.filter((p) => p.source === filters.source);
  if (filters.dueBy) prospects = prospects.filter((p) => p.nextActionDate !== null && p.nextActionDate <= filters.dueBy!);
  if (filters.campaignId) prospects = prospects.filter((p) => p.campaignId === filters.campaignId);

  return prospects;
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const doc = await getAdminFirestore().collection(PROSPECTS).doc(id).get();
  return doc.exists ? prospectFromDoc(doc) : null;
}

export interface CreateProspectInput {
  name: string;
  contactName?: string | null;
  contactRole?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  estimatedFleetSizeRaw?: string | null;
  primaryPainRaw?: string | null;
  source?: ProspectSource;
  campaignId?: string | null;
}

/** Phase 0 §6.5 — the one prospect-creation path that wasn't already covered by seedProspectsFromCsv() (outbound) or syncLeadsToProspects() (inbound website leads). Same phone-classification/defaulting discipline as both of those. */
export async function createProspect(input: CreateProspectInput): Promise<Prospect> {
  const db = getAdminFirestore();
  const phone = input.contactPhone ?? input.contactWhatsapp ?? null;
  const whatsapp = input.contactWhatsapp ?? input.contactPhone ?? null;
  const phoneClassification = computePhoneClassification(phone, whatsapp);
  const now = FieldValue.serverTimestamp();
  const today = new Date().toISOString().slice(0, 10);

  const ref = await db.collection(PROSPECTS).add({
    name: input.name,
    contactName: input.contactName ?? null,
    contactRole: input.contactRole ?? null,
    contactPhone: phone,
    contactWhatsapp: whatsapp,
    contactEmail: input.contactEmail ?? null,
    location: input.location ?? null,
    estimatedFleetSizeRaw: input.estimatedFleetSizeRaw ?? null,
    primaryPainRaw: input.primaryPainRaw ?? null,
    phoneClassification,
    source: input.source ?? "other",
    stage: 0 satisfies PipelineStage,
    lastInteractionOutcome: null,
    lastInteractionSummary: null,
    lastContactDate: null,
    nextActionDate: today,
    nextActionType: phoneClassification.recommendedChannel,
    nextActionNote: null,
    priorityScore: null,
    intelligence: {},
    linkedLeadId: null,
    linkedVisitorId: null,
    visitorSnapshot: null,
    campaignId: input.campaignId ?? null,
    icpFitScore: null,
    opportunityScore: null,
    riskFlags: [],
    flags: ["manual-entry"],
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  const doc = await ref.get();
  return prospectFromDoc(doc);
}

export interface UpdateProspectInput {
  name?: string;
  contactName?: string | null;
  contactRole?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  estimatedFleetSizeRaw?: string | null;
  primaryPainRaw?: string | null;
  stage?: PipelineStage;
  nextActionDate?: string | null;
  nextActionType?: InteractionType | null;
  nextActionNote?: string | null;
  priorityScore?: number | null;
  flags?: string[];
  campaignId?: string | null;
  icpFitScore?: number | null;
  opportunityScore?: number | null;
  riskFlags?: string[];
  /** true archives (the Friday Pipeline Cleanse), false restores. */
  archived?: boolean;
}

export async function updateProspect(id: string, patch: UpdateProspectInput): Promise<void> {
  const db = getAdminFirestore();
  const data: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  for (const [key, value] of Object.entries(patch)) {
    if (key === "archived") {
      data.archivedAt = value ? FieldValue.serverTimestamp() : null;
    } else if (value !== undefined) {
      data[key] = value;
    }
  }

  await db.collection(PROSPECTS).doc(id).update(data);
  await invalidateProspectContext(id);
}

/** Merges AI-generated (or human-confirmed) intelligence fields into the prospect's provenance-tagged intelligence map. A present `priorityScore` field is also lifted to the top-level priorityScore column, since that's what listing/sorting reads. */
export async function applyIntelligence(id: string, fields: Partial<ProspectIntelligence>): Promise<void> {
  const db = getAdminFirestore();
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const [key, value] of Object.entries(fields)) {
    patch[`intelligence.${key}`] = value;
  }
  if (fields.priorityScore) patch.priorityScore = fields.priorityScore.value;
  await db.collection(PROSPECTS).doc(id).update(patch);
  await invalidateProspectContext(id);
}

export async function listInteractions(prospectId: string): Promise<Interaction[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(INTERACTIONS).where("prospectId", "==", prospectId).limit(200).get();
  return snapshot.docs.map(interactionFromDoc).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface LogInteractionInput {
  type: InteractionType;
  outcome?: InteractionOutcome | null;
  rawNote?: string | null;
  createdBy: string;
  aiExtracted?: Interaction["aiExtracted"];
}

/** Brief #6, Rule 1: logging an interaction is the natural moment the prospect's lastContactDate/lastInteractionOutcome update — never left for a separate step. */
export async function logInteraction(prospectId: string, input: LogInteractionInput): Promise<Interaction> {
  const db = getAdminFirestore();
  const nowIso = new Date().toISOString();

  const ref = await db.collection(INTERACTIONS).add({
    prospectId,
    type: input.type,
    outcome: input.outcome ?? null,
    rawNote: input.rawNote ?? null,
    aiExtracted: input.aiExtracted ?? null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: input.createdBy,
  });

  await db
    .collection(PROSPECTS)
    .doc(prospectId)
    .update({
      lastInteractionOutcome: input.outcome ?? null,
      lastInteractionSummary: input.rawNote ?? (input.outcome ? input.outcome : null),
      lastContactDate: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    });
  await invalidateProspectContext(prospectId);

  const doc = await ref.get();
  return interactionFromDoc(doc);
}

function computePhoneClassification(phone: string | null, whatsapp: string | null): PhoneClassification {
  return classifyZambianPhone(whatsapp || phone);
}

/**
 * Brief #40's V1 acceptance step 1-2 — the 52-company outbound cold
 * list, idempotent by (name, source) so re-running only adds genuinely
 * new rows rather than duplicating on every click. Every row starts at
 * stage 1 ("Researched" — we have public-directory-level facts, nobody
 * has attempted contact yet) and gets a real, rules-based
 * recommendedChannel from phoneRules.ts rather than a guess.
 */
export async function seedProspectsFromCsv(): Promise<{ created: number; skipped: number }> {
  const db = getAdminFirestore();
  const existingSnap = await db.collection(PROSPECTS).where("source", "==", "outbound-cold-list").limit(500).get();
  const existingNames = new Set(existingSnap.docs.map((doc) => ((doc.data().name as string) ?? "").toLowerCase()));

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  let skipped = 0;

  for (const row of PROSPECT_SEED_ROWS) {
    if (existingNames.has(row.name.toLowerCase())) {
      skipped++;
      continue;
    }

    const phoneClassification = computePhoneClassification(row.phone, row.whatsapp);
    const now = FieldValue.serverTimestamp();

    await db.collection(PROSPECTS).add({
      name: row.name,
      contactName: row.contactName,
      contactRole: row.contactRole,
      contactPhone: row.phone,
      contactWhatsapp: row.whatsapp,
      contactEmail: row.email,
      location: row.location,
      estimatedFleetSizeRaw: row.estimatedFleetSizeRaw,
      primaryPainRaw: row.primaryPainRaw,
      phoneClassification,
      source: "outbound-cold-list" satisfies ProspectSource,
      stage: 1 satisfies PipelineStage,
      lastInteractionOutcome: null,
      lastInteractionSummary: null,
      lastContactDate: null,
      nextActionDate: today,
      nextActionType: phoneClassification.recommendedChannel,
      nextActionNote: row.notes,
      priorityScore: null,
      intelligence: {},
      linkedLeadId: null,
      linkedVisitorId: null,
      visitorSnapshot: null,
      flags: ["outbound-seed"],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    created++;
  }

  return { created, skipped };
}

function mapLeadSourceToProspectSource(leadSource: unknown): ProspectSource {
  switch (leadSource) {
    case "contact-form":
      return "inbound-contact-form";
    case "homepage-cta":
      return "inbound-homepage-cta";
    case "demo-gate":
      return "inbound-demo-gate";
    default:
      return "other";
  }
}

function topPagesFromCounts(counts: Record<string, number> | undefined, limit = 5): string[] {
  if (!counts) return [];
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path]) => path);
}

/**
 * The "No Orphan Lead" rule (Sales Playbook §6 / AI Workforce Manual
 * Role 05) closes the loop between the marketing site's Visitor
 * Intelligence pipeline and DeployFleet's own sales pipeline: every
 * website form submission becomes a real prospect record, not a second,
 * disconnected list — and, per this session's explicit direction, one
 * that already carries the visitor's real engagement/intent history
 * rather than starting cold. Idempotent via `promotedToProspectId` on
 * the source lead doc. The visitor is found via the *reverse* lookup
 * (`visitors` where `leadId == this lead's id`) since linkVisitorToLead()
 * in visitorIntelligence.ts only ever writes the relationship onto the
 * visitor doc, not back onto the lead — a single equality filter, no
 * composite index needed.
 */
export async function syncLeadsToProspects(): Promise<{ promoted: number }> {
  const db = getAdminFirestore();
  const leadsSnapshot = await db.collection(LEADS).limit(1000).get();

  let promoted = 0;
  for (const doc of leadsSnapshot.docs) {
    const lead = doc.data();
    if (lead.promotedToProspectId) continue;

    const visitorSnap = await db.collection(VISITORS).where("leadId", "==", doc.id).limit(1).get();
    const visitorDoc = visitorSnap.empty ? null : visitorSnap.docs[0];
    const visitorData = visitorDoc?.data();

    const visitorSnapshot: VisitorSnapshot | null =
      visitorDoc && visitorData
        ? {
            visitorId: visitorDoc.id,
            engagementScore: (visitorData.engagementScore as number) ?? 0,
            intentScore: (visitorData.intentScore as number) ?? 0,
            totalSessions: (visitorData.totalSessions as number) ?? 0,
            totalPageViews: (visitorData.totalPageViews as number) ?? 0,
            topPages: topPagesFromCounts(visitorData.pageViewCounts as Record<string, number> | undefined),
            lastSeenAt: tsToIso(visitorData.lastSeenAt) ?? new Date(0).toISOString(),
            firstLandingPage: (visitorData.firstLandingPage as string) ?? null,
            lastReferrerType: (visitorData.lastReferrerType as string) ?? "unknown",
          }
        : null;

    const phone = (lead.phone as string) ?? null;
    const phoneClassification = computePhoneClassification(phone, phone);
    const now = FieldValue.serverTimestamp();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const primaryPain =
      [lead.message as string | null, lead.fleetSize ? `Fleet size (self-reported): ${lead.fleetSize}` : null]
        .filter(Boolean)
        .join(" | ") || null;

    const prospectRef = await db.collection(PROSPECTS).add({
      name: (lead.company as string) || (lead.name as string) || "Unnamed prospect",
      contactName: (lead.name as string) ?? null,
      contactRole: null,
      contactPhone: phone,
      contactWhatsapp: phone,
      contactEmail: null,
      location: null,
      estimatedFleetSizeRaw: (lead.fleetSize as string) ?? null,
      primaryPainRaw: primaryPain,
      phoneClassification,
      source: mapLeadSourceToProspectSource(lead.source),
      // An inbound form submission *is* the first contact — unlike the
      // outbound cold list, which starts at 1 ("Researched") since
      // nobody has reached out yet.
      stage: 3 satisfies PipelineStage,
      lastInteractionOutcome: null,
      lastInteractionSummary: null,
      lastContactDate: null,
      nextActionDate: tomorrow.toISOString().slice(0, 10),
      nextActionType: phoneClassification.recommendedChannel,
      nextActionNote: "Follow up on website inquiry",
      // Seeded from the linked visitor's real intent score when one
      // exists — a genuine behavioral signal, not a placeholder; null
      // (not 0) when there's no linked visitor, so it reads as "not yet
      // scored" rather than "scored zero."
      priorityScore: visitorSnapshot ? visitorSnapshot.intentScore : null,
      intelligence: {},
      linkedLeadId: doc.id,
      linkedVisitorId: visitorSnapshot?.visitorId ?? null,
      visitorSnapshot,
      flags: ["website-inbound"],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    await doc.ref.update({ promotedToProspectId: prospectRef.id });
    promoted++;
  }

  return { promoted };
}

function campaignFromDoc(doc: DocumentSnapshot): Campaign {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    name: (d.name as string) ?? "",
    startDate: (d.startDate as string) ?? new Date(0).toISOString().slice(0, 10),
    endDate: (d.endDate as string) ?? null,
    targetAttempts: (d.targetAttempts as number) ?? null,
    targetMeaningfulInteractions: (d.targetMeaningfulInteractions as number) ?? null,
    status: (d.status as CampaignStatus) ?? "active",
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(CAMPAIGNS).orderBy("createdAt", "desc").limit(200).get();
  return snapshot.docs.map(campaignFromDoc);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const doc = await getAdminFirestore().collection(CAMPAIGNS).doc(id).get();
  return doc.exists ? campaignFromDoc(doc) : null;
}

export interface CreateCampaignInput {
  name: string;
  startDate: string;
  endDate?: string | null;
  targetAttempts?: number | null;
  targetMeaningfulInteractions?: number | null;
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(CAMPAIGNS).add({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    targetAttempts: input.targetAttempts ?? null,
    targetMeaningfulInteractions: input.targetMeaningfulInteractions ?? null,
    status: "active" satisfies CampaignStatus,
    createdAt: now,
    updatedAt: now,
  });
  const doc = await ref.get();
  return campaignFromDoc(doc);
}

export interface UpdateCampaignInput {
  name?: string;
  endDate?: string | null;
  targetAttempts?: number | null;
  targetMeaningfulInteractions?: number | null;
  status?: CampaignStatus;
}

export async function updateCampaign(id: string, patch: UpdateCampaignInput): Promise<void> {
  const db = getAdminFirestore();
  await db
    .collection(CAMPAIGNS)
    .doc(id)
    .update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}

export interface DayScoreboard {
  date: string;
  attempts: number;
  meaningful: number;
}

export interface WeeklyScoreboard {
  weekStart: string;
  days: DayScoreboard[];
  totalAttempts: number;
  totalMeaningful: number;
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
}

/**
 * Phase 0 §6.2 — the Operating Rhythm brief's own "10 attempts, 5
 * meaningful interactions" daily benchmark, made visible. `weekStartIso`
 * is the Monday (or whichever day the caller treats as week-start) of
 * the week to report on, as a plain YYYY-MM-DD date. Bounded fetch
 * across the whole `interactions` collection, filtered in memory by
 * date — the same composite-index-avoidance discipline as everywhere
 * else in this file; fine at this data volume.
 */
export async function getWeeklyScoreboard(weekStartIso: string): Promise<WeeklyScoreboard> {
  const db = getAdminFirestore();
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const snapshot = await db.collection(INTERACTIONS).limit(5000).get();

  const days: DayScoreboard[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), attempts: 0, meaningful: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const createdAtIso = tsToIso(data.createdAt);
    if (!createdAtIso) continue;
    const createdAt = new Date(createdAtIso);
    if (createdAt < weekStart || createdAt >= weekEnd) continue;
    const idx = dayIndex.get(createdAtIso.slice(0, 10));
    if (idx === undefined) continue;
    days[idx].attempts++;
    if (MEANINGFUL_OUTCOMES.has(data.outcome as InteractionOutcome)) days[idx].meaningful++;
  }

  return {
    weekStart: weekStartIso,
    days,
    totalAttempts: days.reduce((sum, d) => sum + d.attempts, 0),
    totalMeaningful: days.reduce((sum, d) => sum + d.meaningful, 0),
    targetAttemptsPerDay: TARGET_ATTEMPTS_PER_DAY,
    targetMeaningfulPerDay: TARGET_MEANINGFUL_PER_DAY,
  };
}

export interface CampaignScoreboard {
  campaign: Campaign;
  prospectCount: number;
  attempts: number;
  meaningful: number;
}

/** Phase 0 §6.3 — a campaign's own performance, scoped by which prospects belong to it (Prospect.campaignId) rather than by date range, so it stays accurate even if the campaign's own dates are left open-ended. */
export async function getCampaignScoreboard(campaignId: string): Promise<CampaignScoreboard | null> {
  const db = getAdminFirestore();
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;

  const prospectsSnap = await db.collection(PROSPECTS).where("campaignId", "==", campaignId).limit(1000).get();
  const prospectIds = new Set(prospectsSnap.docs.map((doc) => doc.id));

  const interactionsSnap = await db.collection(INTERACTIONS).limit(5000).get();
  let attempts = 0;
  let meaningful = 0;
  for (const doc of interactionsSnap.docs) {
    const data = doc.data();
    if (!prospectIds.has(data.prospectId as string)) continue;
    attempts++;
    if (MEANINGFUL_OUTCOMES.has(data.outcome as InteractionOutcome)) meaningful++;
  }

  return { campaign, prospectCount: prospectIds.size, attempts, meaningful };
}

// ---------------------------------------------------------------------------
// Phase 1 — facts / tasks / decisions / auditEvents / aiEmployees
// See docs/ai-marketing-os-architecture.md §4, §7. Same conventions as
// everything above: createdAt/updatedAt as Timestamp, ISO strings at the
// type layer, broad-fetch-then-filter-in-memory to avoid composite
// indexes.
// ---------------------------------------------------------------------------

function auditEventFromDoc(doc: DocumentSnapshot): AuditEvent {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    eventType: (d.eventType as AuditEventType) ?? "prospect_updated",
    summary: (d.summary as string) ?? "",
    relatedProspectId: (d.relatedProspectId as string) ?? null,
    relatedEmployeeId: (d.relatedEmployeeId as string) ?? null,
    actor: (d.actor as AuditEventActor) ?? "winston",
    metadata: (d.metadata as Record<string, unknown>) ?? null,
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateAuditEventInput {
  eventType: AuditEventType;
  summary: string;
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
  actor: AuditEventActor;
  metadata?: Record<string, unknown> | null;
}

/** §4.8 — append-only; every write path below that touches a Fact/Task/Decision/Prospect also calls this. Never edited or deleted once written. */
export async function createAuditEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
  const db = getAdminFirestore();
  const ref = await db.collection(AUDIT_EVENTS).add({
    eventType: input.eventType,
    summary: input.summary,
    relatedProspectId: input.relatedProspectId ?? null,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    actor: input.actor,
    metadata: input.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  return auditEventFromDoc(doc);
}

export interface ListAuditEventsFilters {
  relatedProspectId?: string;
  relatedEmployeeId?: string;
  limit?: number;
}

export async function listAuditEvents(filters: ListAuditEventsFilters = {}): Promise<AuditEvent[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(AUDIT_EVENTS)
    .orderBy("createdAt", "desc")
    .limit(filters.limit ?? 500)
    .get();
  let events = snapshot.docs.map(auditEventFromDoc);
  if (filters.relatedProspectId) events = events.filter((e) => e.relatedProspectId === filters.relatedProspectId);
  if (filters.relatedEmployeeId) events = events.filter((e) => e.relatedEmployeeId === filters.relatedEmployeeId);
  return events;
}

function factFromDoc(doc: DocumentSnapshot): Fact {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    factType: (d.factType as FactType) ?? "other",
    key: (d.key as string) ?? "",
    value: (d.value as string) ?? "",
    source: (d.source as string) ?? "",
    sourceType: (d.sourceType as Fact["sourceType"]) ?? "ai_research",
    confidence: (d.confidence as number) ?? null,
    status: (d.status as FactLifecycleStatus) ?? "active",
    supersedes: (d.supersedes as string) ?? null,
    supersededBy: (d.supersededBy as string) ?? null,
    verifiedAt: (d.verifiedAt as string) ?? null,
    lastCheckedAt: (d.lastCheckedAt as string) ?? new Date(0).toISOString(),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateFactInput {
  prospectId: string;
  factType: FactType;
  key: string;
  value: string;
  source: string;
  sourceType: Fact["sourceType"];
  confidence?: number | null;
  status?: FactLifecycleStatus;
}

/**
 * §4.2 — writes a new Fact and supersedes any existing active Fact with
 * the same prospectId+key (a single-equality-filter fetch, filtered by
 * key in memory, not a compound where() — the same composite-index
 * avoidance as everywhere else in this file). Note: ProspectIntelligence's
 * own named fields (fleetTier, likelyPain, ...) are still written
 * directly by applyIntelligence() (the SDR brief route) — there's no
 * automatic Fact-to-ProspectIntelligence projection in Phase 1. `facts`
 * is its own ledger, browsable on the Prospect Intelligence page's
 * Intelligence tab; worth revisiting if that split becomes a real
 * usability problem once there's more data.
 */
export async function createFact(input: CreateFactInput): Promise<Fact> {
  const db = getAdminFirestore();
  const nowIso = new Date().toISOString();

  const existingSnap = await db.collection(FACTS).where("prospectId", "==", input.prospectId).limit(500).get();
  const toSupersede = existingSnap.docs.filter((doc) => doc.data().key === input.key && doc.data().status === "active");

  const ref = await db.collection(FACTS).add({
    prospectId: input.prospectId,
    factType: input.factType,
    key: input.key,
    value: input.value,
    source: input.source,
    sourceType: input.sourceType,
    confidence: input.confidence ?? null,
    status: input.status ?? ("active" satisfies FactLifecycleStatus),
    supersedes: toSupersede[0]?.id ?? null,
    supersededBy: null,
    verifiedAt: input.sourceType === "human_confirmed" ? nowIso : null,
    lastCheckedAt: nowIso,
    createdAt: FieldValue.serverTimestamp(),
  });

  for (const doc of toSupersede) {
    await doc.ref.update({ status: "superseded" satisfies FactLifecycleStatus, supersededBy: ref.id });
  }
  await invalidateProspectContext(input.prospectId);

  const doc = await ref.get();
  return factFromDoc(doc);
}

export async function listFacts(prospectId: string): Promise<Fact[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(FACTS).where("prospectId", "==", prospectId).limit(500).get();
  return snapshot.docs.map(factFromDoc).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** §7.5's Reality & Reconciliation Engine needs facts across every prospect at once, not one prospect at a time — the one caller of this broader, unscoped fetch. */
export async function listAllFacts(limitCount = 5000): Promise<Fact[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(FACTS).limit(limitCount).get();
  return snapshot.docs.map(factFromDoc);
}

/** §7.5's "stalled facts" check reads/writes this directly — marks an active Fact as needing a human look without waiting for a new Fact to supersede it. */
export async function markFactStatus(id: string, status: FactLifecycleStatus): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(FACTS).doc(id);
  await ref.update({ status, lastCheckedAt: new Date().toISOString() });
  const doc = await ref.get();
  const prospectId = doc.data()?.prospectId as string | undefined;
  if (prospectId) await invalidateProspectContext(prospectId);
}

function taskFromDoc(doc: DocumentSnapshot): Task {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    title: (d.title as string) ?? "",
    description: (d.description as string) ?? null,
    relatedProspectId: (d.relatedProspectId as string) ?? null,
    relatedEmployeeId: (d.relatedEmployeeId as string) ?? null,
    dueDate: (d.dueDate as string) ?? null,
    status: (d.status as TaskStatus) ?? "open",
    priority: (d.priority as TaskPriority) ?? "medium",
    createdBy: (d.createdBy as TaskCreatedBy) ?? "human",
    sourceInboxEntryId: (d.sourceInboxEntryId as string) ?? null,
    incompleteReason: (d.incompleteReason as Task["incompleteReason"]) ?? null,
    completedAt: tsToIso(d.completedAt),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  createdBy: TaskCreatedBy;
  sourceInboxEntryId?: string | null;
}

/** §4.3 — generalizes beyond Prospect.nextActionDate/nextActionType (which stay untouched — /admin/today still reads those) for tasks that aren't a single prospect follow-up, e.g. an AI employee's research task. */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(TASKS).add({
    title: input.title,
    description: input.description ?? null,
    relatedProspectId: input.relatedProspectId ?? null,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    dueDate: input.dueDate ?? null,
    status: "open" satisfies TaskStatus,
    priority: input.priority ?? "medium",
    createdBy: input.createdBy,
    sourceInboxEntryId: input.sourceInboxEntryId ?? null,
    incompleteReason: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  if (input.relatedProspectId) await invalidateProspectContext(input.relatedProspectId);
  if (input.relatedEmployeeId) await invalidateEmployeeContext(input.relatedEmployeeId);
  const doc = await ref.get();
  return taskFromDoc(doc);
}

export interface ListTasksFilters {
  relatedProspectId?: string;
  relatedEmployeeId?: string;
  status?: TaskStatus;
}

export async function listTasks(filters: ListTasksFilters = {}): Promise<Task[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(TASKS).orderBy("createdAt", "desc").limit(1000).get();
  let tasks = snapshot.docs.map(taskFromDoc);
  if (filters.relatedProspectId) tasks = tasks.filter((t) => t.relatedProspectId === filters.relatedProspectId);
  if (filters.relatedEmployeeId) tasks = tasks.filter((t) => t.relatedEmployeeId === filters.relatedEmployeeId);
  if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);
  return tasks;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** Phase 3 §9 — set during an end-of-day review, on a task that's still incomplete. */
  incompleteReason?: TaskIncompleteReason | null;
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(TASKS).doc(id);
  const existing = await ref.get();
  const data: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() };
  if (patch.status === "done") data.completedAt = FieldValue.serverTimestamp();
  await ref.update(data);
  const relatedProspectId = existing.data()?.relatedProspectId as string | undefined;
  const relatedEmployeeId = existing.data()?.relatedEmployeeId as string | undefined;
  if (relatedProspectId) await invalidateProspectContext(relatedProspectId);
  if (relatedEmployeeId) await invalidateEmployeeContext(relatedEmployeeId);
}

export async function completeTask(id: string): Promise<void> {
  await updateTask(id, { status: "done" });
}

function decisionFromDoc(doc: DocumentSnapshot): Decision {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    decisionText: (d.decisionText as string) ?? "",
    reason: (d.reason as string) ?? "",
    scope: (d.scope as DecisionScope) ?? { type: "global" },
    evidence: Array.isArray(d.evidence) ? (d.evidence as string[]) : [],
    status: (d.status as DecisionStatus) ?? "active",
    supersedes: (d.supersedes as string) ?? null,
    supersededBy: (d.supersededBy as string) ?? null,
    madeBy: (d.madeBy as Decision["madeBy"]) ?? "winston",
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

function invalidateForScope(scope: DecisionScope): Promise<void> {
  if (scope.type === "prospect") return invalidateProspectContext(scope.prospectId);
  if (scope.type === "employee") return invalidateEmployeeContext(scope.employeeId);
  return invalidateGlobalContext();
}

export interface CreateDecisionInput {
  decisionText: string;
  reason: string;
  scope: DecisionScope;
  evidence?: string[];
  madeBy: Decision["madeBy"];
}

/** §4.4 — the Decision Ledger. Never edited in place; supersedeDecision() below is the only path that changes an existing decision's status. */
export async function createDecision(input: CreateDecisionInput): Promise<Decision> {
  const db = getAdminFirestore();
  const ref = await db.collection(DECISIONS).add({
    decisionText: input.decisionText,
    reason: input.reason,
    scope: input.scope,
    evidence: input.evidence ?? [],
    status: "active" satisfies DecisionStatus,
    supersedes: null,
    supersededBy: null,
    madeBy: input.madeBy,
    createdAt: FieldValue.serverTimestamp(),
  });
  await invalidateForScope(input.scope);
  const doc = await ref.get();
  return decisionFromDoc(doc);
}

export interface ListDecisionsFilters {
  status?: DecisionStatus;
}

export async function listDecisions(filters: ListDecisionsFilters = {}): Promise<Decision[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(DECISIONS).orderBy("createdAt", "desc").limit(500).get();
  let decisions = snapshot.docs.map(decisionFromDoc);
  if (filters.status) decisions = decisions.filter((d) => d.status === filters.status);
  return decisions;
}

/** Creates the replacement decision, then marks the old one superseded and links both directions — decisions are never edited in place, matching the ledger's own append-only nature. */
export async function supersedeDecision(id: string, replacement: CreateDecisionInput): Promise<Decision> {
  const db = getAdminFirestore();
  const oldRef = db.collection(DECISIONS).doc(id);
  const oldDoc = await oldRef.get();
  const created = await createDecision(replacement);
  await oldRef.update({ status: "superseded" satisfies DecisionStatus, supersededBy: created.id });
  await db.collection(DECISIONS).doc(created.id).update({ supersedes: id });
  if (oldDoc.exists) await invalidateForScope(decisionFromDoc(oldDoc).scope);
  return { ...created, supersedes: id };
}

function aiEmployeeFromDoc(doc: DocumentSnapshot): AiEmployee {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    name: (d.name as string) ?? "",
    role: (d.role as string) ?? "",
    mission: (d.mission as string) ?? "",
    status: (d.status as AiEmployeeStatus) ?? "active",
    instructions: (d.instructions as string) ?? "",
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export async function listAiEmployees(): Promise<AiEmployee[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(AI_EMPLOYEES).orderBy("createdAt", "asc").limit(100).get();
  return snapshot.docs.map(aiEmployeeFromDoc);
}

export async function getAiEmployee(id: string): Promise<AiEmployee | null> {
  const doc = await getAdminFirestore().collection(AI_EMPLOYEES).doc(id).get();
  return doc.exists ? aiEmployeeFromDoc(doc) : null;
}

export interface UpdateAiEmployeeInput {
  mission?: string;
  status?: AiEmployeeStatus;
  instructions?: string;
}

export async function updateAiEmployee(id: string, patch: UpdateAiEmployeeInput): Promise<void> {
  await getAdminFirestore()
    .collection(AI_EMPLOYEES)
    .doc(id)
    .update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
  await invalidateEmployeeContext(id);
}

/**
 * §7.3 — five starter personas matching the GTM/Sales Playbook briefs'
 * own AI-workforce roles. The specific first names below are reasonable
 * placeholders, not transcribed from an original source doc this session
 * has access to — Winston can rename any of them from the Team page.
 */
const AI_EMPLOYEE_SEED: { name: string; role: string; mission: string; instructions: string }[] = [
  {
    name: "Charity",
    role: "AI SDR",
    mission: "Run first-contact outreach and qualify inbound/outbound prospects before they reach Winston's queue.",
    instructions: "Paste call/WhatsApp/email conversation summaries here after each prospect interaction.",
  },
  {
    name: "Mwansa",
    role: "AI Researcher",
    mission: "Research prospect companies — fleet size, current tooling, decision-makers — before first contact.",
    instructions: "Paste research findings per prospect; note source and confidence where possible.",
  },
  {
    name: "Bupe",
    role: "AI Sales Coach",
    mission: "Review call transcripts and coach on what went well, what was missed, and the best next question.",
    instructions: "Paste call transcripts (sourceType: call transcript) for structured coaching feedback.",
  },
  {
    name: "Chanda",
    role: "AI Market Intelligence",
    mission: "Track competitor moves, pricing signals, and market trends relevant to DeployFleet's positioning.",
    instructions: "Paste market/competitor findings as they come up, not on a fixed schedule.",
  },
  {
    name: "Natasha",
    role: "AI SEO",
    mission: "Monitor DeployFleet's organic search performance and content opportunities.",
    instructions: "Paste SEO/content research and ranking updates here.",
  },
];

function inboxEntryFromDoc(doc: DocumentSnapshot): InboxEntry {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    rawText: (d.rawText as string) ?? "",
    sourceType: (d.sourceType as InboxSourceType) ?? "winston_direct",
    relatedProspectId: (d.relatedProspectId as string) ?? null,
    relatedEmployeeId: (d.relatedEmployeeId as string) ?? null,
    pastedAt: tsToIso(d.pastedAt) ?? new Date(0).toISOString(),
    extractionStatus: (d.extractionStatus as ExtractionStatus) ?? "pending",
    extractionResult: (d.extractionResult as ExtractionResult) ?? null,
    reviewedByWinston: Boolean(d.reviewedByWinston),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateInboxEntryInput {
  rawText: string;
  sourceType: InboxSourceType;
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
}

/** §4.5/§7.1 — the AI Inbox's raw, immutable paste record. Created with extractionStatus "pending"; the extraction route (built in a later step) fills extractionResult via setInboxEntryExtraction() right after. */
export async function createInboxEntry(input: CreateInboxEntryInput): Promise<InboxEntry> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(INBOX_ENTRIES).add({
    rawText: input.rawText,
    sourceType: input.sourceType,
    relatedProspectId: input.relatedProspectId ?? null,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
    pastedAt: now,
    extractionStatus: "pending" satisfies ExtractionStatus,
    extractionResult: null,
    reviewedByWinston: false,
    createdAt: now,
  });
  if (input.relatedProspectId) await invalidateProspectContext(input.relatedProspectId);
  if (input.relatedEmployeeId) await invalidateEmployeeContext(input.relatedEmployeeId);
  const doc = await ref.get();
  return inboxEntryFromDoc(doc);
}

export async function getInboxEntry(id: string): Promise<InboxEntry | null> {
  const doc = await getAdminFirestore().collection(INBOX_ENTRIES).doc(id).get();
  return doc.exists ? inboxEntryFromDoc(doc) : null;
}

export interface ListInboxEntriesFilters {
  relatedProspectId?: string;
  relatedEmployeeId?: string;
  limit?: number;
}

export async function listInboxEntries(filters: ListInboxEntriesFilters = {}): Promise<InboxEntry[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(INBOX_ENTRIES)
    .orderBy("createdAt", "desc")
    .limit(filters.limit ?? 500)
    .get();
  let entries = snapshot.docs.map(inboxEntryFromDoc);
  if (filters.relatedProspectId) entries = entries.filter((e) => e.relatedProspectId === filters.relatedProspectId);
  if (filters.relatedEmployeeId) entries = entries.filter((e) => e.relatedEmployeeId === filters.relatedEmployeeId);
  return entries;
}

export async function setInboxEntryExtraction(id: string, status: ExtractionStatus, result: ExtractionResult | null): Promise<void> {
  await getAdminFirestore().collection(INBOX_ENTRIES).doc(id).update({ extractionStatus: status, extractionResult: result });
}

export async function markInboxEntryReviewed(id: string): Promise<void> {
  await getAdminFirestore().collection(INBOX_ENTRIES).doc(id).update({ reviewedByWinston: true });
}

export async function seedAiEmployees(): Promise<{ created: number; skipped: number }> {
  const db = getAdminFirestore();
  const existingSnap = await db.collection(AI_EMPLOYEES).limit(100).get();
  const existingNames = new Set(existingSnap.docs.map((doc) => ((doc.data().name as string) ?? "").toLowerCase()));

  let created = 0;
  let skipped = 0;
  for (const persona of AI_EMPLOYEE_SEED) {
    if (existingNames.has(persona.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const now = FieldValue.serverTimestamp();
    await db.collection(AI_EMPLOYEES).add({
      name: persona.name,
      role: persona.role,
      mission: persona.mission,
      status: "active" satisfies AiEmployeeStatus,
      instructions: persona.instructions,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }
  return { created, skipped };
}

function emailSendFromDoc(doc: DocumentSnapshot): EmailSend {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    recipientEmail: (d.recipientEmail as string) ?? "",
    template: (d.template as EmailTemplateKey) ?? "cold_outreach",
    campaignId: (d.campaignId as string) ?? null,
    status: (d.status as EmailSendStatus) ?? "failed",
    errorMessage: (d.errorMessage as string) ?? null,
    sentAt: tsToIso(d.sentAt) ?? new Date(0).toISOString(),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateEmailSendInput {
  prospectId: string;
  recipientEmail: string;
  template: EmailTemplateKey;
  campaignId?: string | null;
  status: EmailSendStatus;
  errorMessage?: string | null;
}

export async function createEmailSend(input: CreateEmailSendInput): Promise<EmailSend> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(EMAIL_SENDS).add({
    prospectId: input.prospectId,
    recipientEmail: input.recipientEmail,
    template: input.template,
    campaignId: input.campaignId ?? null,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    sentAt: now,
    createdAt: now,
  });
  const doc = await ref.get();
  return emailSendFromDoc(doc);
}

export interface ListEmailSendsFilters {
  prospectId?: string;
  limit?: number;
}

export async function listEmailSends(filters: ListEmailSendsFilters = {}): Promise<EmailSend[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(EMAIL_SENDS)
    .orderBy("createdAt", "desc")
    .limit(filters.limit ?? 2000)
    .get();
  let sends = snapshot.docs.map(emailSendFromDoc);
  if (filters.prospectId) sends = sends.filter((s) => s.prospectId === filters.prospectId);
  return sends;
}

/**
 * The 20/day cap's own counter — only "sent" sends count against it
 * (a failed EmailJS call, e.g. a transient outage, shouldn't cost
 * Winston part of his daily allowance). Bounded fetch (2000, matching
 * every other "fetch broadly, filter in memory" query in this file) —
 * fine at this system's real scale of at most 20 new rows a day.
 */
export async function countEmailSendsToday(): Promise<number> {
  const sends = await listEmailSends({ limit: 2000 });
  const today = new Date().toISOString().slice(0, 10);
  return sends.filter((s) => s.status === "sent" && s.createdAt.slice(0, 10) === today).length;
}
