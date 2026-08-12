import "server-only";
import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin";
import { classifyZambianPhone } from "./phoneRules";
import { PROSPECT_SEED_ROWS } from "./prospectSeedData";
import { invalidateEmployeeContext, invalidateGlobalContext, invalidateProspectContext } from "./ai/contextCache";
import { getGoalsConfig } from "./goals";
import type {
  AiEmployee,
  AiEmployeeStatus,
  AuditEvent,
  AuditEventActor,
  AuditEventType,
  BuyingSignalType,
  Campaign,
  CampaignStatus,
  ConversationState,
  Decision,
  DecisionScope,
  DecisionStatus,
  Directive,
  DirectiveStatus,
  GoalsConfig,
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
  ProspectContact,
  ProspectIntelligence,
  ProspectSource,
  Task,
  TaskCreatedBy,
  TaskIncompleteReason,
  TaskPriority,
  TaskStatus,
  VisitorSnapshot,
  WhatsAppConversation,
  WhatsAppEntity,
  WhatsAppMessage,
  WhatsAppMessageAnalysis,
  WhatsAppMessageSenderType,
  WhatsAppNumberStatus,
  WhatsAppSend,
  WhatsAppSendStatus,
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
const DIRECTIVES = "directives";

/** The Sales Playbook's own "up to 20 a day" cap (Winston's explicit instruction, see docs/ai-marketing-os-architecture.md §12) — enforced here, server-side, never trusted to the client. */
export const DAILY_EMAIL_CAP = 20;

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
    whatsappStatus: (d.whatsappStatus as WhatsAppNumberStatus) ?? "unknown",
    whatsappVerifiedAt: (d.whatsappVerifiedAt as string) ?? null,
    whatsappJid: (d.whatsappJid as string) ?? null,
    whatsappOptedOut: Boolean(d.whatsappOptedOut),
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
    whatsappStatus: "unknown" satisfies WhatsAppNumberStatus,
    whatsappVerifiedAt: null,
    whatsappJid: null,
    whatsappOptedOut: false,
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
  whatsappStatus?: WhatsAppNumberStatus;
  whatsappVerifiedAt?: string | null;
  whatsappJid?: string | null;
  whatsappOptedOut?: boolean;
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

function lastDigits(raw: string | null | undefined, n = 9): string {
  return (raw ?? "").replace(/[^0-9]/g, "").slice(-n);
}

export interface PhoneMatch {
  prospectId: string;
  prospectContactId: string | null;
}

/**
 * §7 — the WhatsApp webhook's own "identify prospect + conversation"
 * step. Matches on the last 9 significant digits (drops any country-code/
 * trunk-prefix formatting difference between how a number was typed into
 * DeployFleet and how it arrives from WhatsApp) against both
 * Prospect.contactWhatsapp/contactPhone and every ProspectContact.phone.
 * Returns null when no match is found — this route deliberately never
 * creates a new Prospect from an unrecognized inbound number (out of
 * scope; see docs/whatsapp-intelligence-architecture.md §7).
 */
export async function findProspectByPhone(phone: string): Promise<PhoneMatch | null> {
  const target = lastDigits(phone);
  if (!target) return null;

  const db = getAdminFirestore();
  const prospectsSnap = await db.collection(PROSPECTS).limit(1000).get();
  for (const doc of prospectsSnap.docs) {
    const d = doc.data();
    if (lastDigits(d.contactWhatsapp as string) === target || lastDigits(d.contactPhone as string) === target) {
      return { prospectId: doc.id, prospectContactId: null };
    }
  }

  const contactsSnap = await db.collection(PROSPECT_CONTACTS).limit(2000).get();
  for (const doc of contactsSnap.docs) {
    const d = doc.data();
    if (lastDigits(d.phone as string) === target) {
      return { prospectId: (d.prospectId as string) ?? "", prospectContactId: doc.id };
    }
  }

  return null;
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

// ---------------------------------------------------------------------------
// Revenue OS RS-0 — Directives (docs/revenue-os-architecture.md §4.1)
// The "Direct" stage: CEO/company objectives pinned to the Command Strip.
// Authored top-down by Winston, never AI-written. Multiple may be active
// at once; archived, never hard-deleted, matching the Decision Ledger's
// own append-only discipline.
// ---------------------------------------------------------------------------

function directiveFromDoc(doc: DocumentSnapshot): Directive {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    title: (d.title as string) ?? "",
    body: (d.body as string) ?? "",
    weekOf: (d.weekOf as string) ?? null,
    status: (d.status as DirectiveStatus) ?? "active",
    createdBy: "winston",
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface ListDirectivesFilters {
  status?: DirectiveStatus;
}

/** Active directives ordered for the Command Strip: standing (weekOf null) first, then week-dated ones newest first. */
export async function listDirectives(filters: ListDirectivesFilters = {}): Promise<Directive[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(DIRECTIVES).orderBy("createdAt", "desc").limit(200).get();
  let directives = snapshot.docs.map(directiveFromDoc);
  if (filters.status) directives = directives.filter((d) => d.status === filters.status);
  return directives.sort((a, b) => {
    if ((a.weekOf === null) !== (b.weekOf === null)) return a.weekOf === null ? -1 : 1;
    if (a.weekOf !== null && b.weekOf !== null && a.weekOf !== b.weekOf) return a.weekOf < b.weekOf ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export interface CreateDirectiveInput {
  title: string;
  body: string;
  weekOf?: string | null;
}

export async function createDirective(input: CreateDirectiveInput): Promise<Directive> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(DIRECTIVES).add({
    title: input.title,
    body: input.body,
    weekOf: input.weekOf ?? null,
    status: "active" satisfies DirectiveStatus,
    createdBy: "winston",
    createdAt: now,
    updatedAt: now,
  });
  // A directive is a global-scope strategic input the Orchestrator/context
  // compiler should see — invalidate the same cache a global Decision does.
  await invalidateGlobalContext();
  const doc = await ref.get();
  return directiveFromDoc(doc);
}

export interface UpdateDirectiveInput {
  title?: string;
  body?: string;
  weekOf?: string | null;
  status?: DirectiveStatus;
}

export async function updateDirective(id: string, patch: UpdateDirectiveInput): Promise<void> {
  const db = getAdminFirestore();
  await db
    .collection(DIRECTIVES)
    .doc(id)
    .update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
  await invalidateGlobalContext();
}

export interface DayScoreboard {
  date: string;
  /** Total interactions logged (the primary "attempts" metric). */
  attempts: number;
  meaningful: number;
  /** Distinct prospects worked that day — the goal set's `prospects` target measures this. */
  prospects: number;
  calls: number;
  whatsapp: number;
  emails: number;
  demos: number;
}

export interface WeeklyScoreboard {
  weekStart: string;
  days: DayScoreboard[];
  totalAttempts: number;
  totalMeaningful: number;
  /** RS-0 §4.3 — the resolved goals config; the Command Strip resolves each day's own target from this. */
  goals: GoalsConfig;
  /** Back-compat surface for SystemState/TargetsTab: the `default` goal set's primary targets. */
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
}

/**
 * Phase 0 §6.2 / Revenue OS RS-0 §5.1 — the Operating Rhythm brief's own
 * daily benchmark, made visible and now configurable. `weekStartIso` is
 * the Monday (or whichever day the caller treats as week-start) of the
 * week to report on, as a plain YYYY-MM-DD date. Bounded fetch across the
 * whole `interactions` collection, filtered in memory by date — the same
 * composite-index-avoidance discipline as everywhere else in this file.
 *
 * RS-0 extends the original attempts/meaningful pair with per-channel
 * sub-counts (calls/WhatsApp/emails/demos) and a distinct-prospect count,
 * so the Command Strip can show progress against each goal bucket, and
 * reads its targets from the editable GoalsConfig rather than the two
 * constants this used to hardcode.
 */
export async function getWeeklyScoreboard(weekStartIso: string): Promise<WeeklyScoreboard> {
  const db = getAdminFirestore();
  const weekStart = new Date(`${weekStartIso}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [snapshot, goals] = await Promise.all([
    db.collection(INTERACTIONS).limit(5000).get(),
    getGoalsConfig(),
  ]);

  const days: DayScoreboard[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), attempts: 0, meaningful: 0, prospects: 0, calls: 0, whatsapp: 0, emails: 0, demos: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  // Track distinct prospects per day for the `prospects` goal bucket.
  const prospectsSeen: Set<string>[] = days.map(() => new Set<string>());

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const createdAtIso = tsToIso(data.createdAt);
    if (!createdAtIso) continue;
    const createdAt = new Date(createdAtIso);
    if (createdAt < weekStart || createdAt >= weekEnd) continue;
    const idx = dayIndex.get(createdAtIso.slice(0, 10));
    if (idx === undefined) continue;
    const day = days[idx];
    day.attempts++;
    const outcome = data.outcome as InteractionOutcome | undefined;
    if (outcome && MEANINGFUL_OUTCOMES.has(outcome)) day.meaningful++;
    const type = data.type as InteractionType | undefined;
    if (type === "call") day.calls++;
    else if (type === "whatsapp") day.whatsapp++;
    else if (type === "email") day.emails++;
    // A demo counts once whether logged as a demo-typed interaction or any
    // interaction whose outcome was a booked demo.
    if (type === "demo" || outcome === "demo-booked") day.demos++;
    const prospectId = data.prospectId as string | undefined;
    if (prospectId) prospectsSeen[idx].add(prospectId);
  }
  days.forEach((day, idx) => {
    day.prospects = prospectsSeen[idx].size;
  });

  return {
    weekStart: weekStartIso,
    days,
    totalAttempts: days.reduce((sum, d) => sum + d.attempts, 0),
    totalMeaningful: days.reduce((sum, d) => sum + d.meaningful, 0),
    goals,
    targetAttemptsPerDay: goals.default.prospects,
    targetMeaningfulPerDay: goals.default.meaningfulConversations,
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

// ---------------------------------------------------------------------------
// WhatsApp Intelligence & Outreach Automation
// docs/whatsapp-intelligence-architecture.md — Phase 4. Same "fetch
// broadly, filter in memory" composite-index-avoidance discipline as every
// section above.
// ---------------------------------------------------------------------------

const PROSPECT_CONTACTS = "prospectContacts";
const WHATSAPP_CONVERSATIONS = "whatsappConversations";
const WHATSAPP_MESSAGES = "whatsappMessages";
const WHATSAPP_MESSAGE_ANALYSES = "whatsappMessageAnalyses";
const WHATSAPP_SENDS = "whatsappSends";

/** §11 — the same daily-cap shape as DAILY_EMAIL_CAP, its own counter. */
export const DAILY_WHATSAPP_CAP = 20;
/** §11 — no more than one outbound message per prospect per 24h. */
export const WHATSAPP_COOLDOWN_HOURS = 24;

function prospectContactFromDoc(doc: DocumentSnapshot): ProspectContact {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    name: (d.name as string) ?? null,
    role: (d.role as string) ?? null,
    phone: (d.phone as string) ?? "",
    whatsappStatus: (d.whatsappStatus as WhatsAppNumberStatus) ?? "unknown",
    whatsappVerifiedAt: (d.whatsappVerifiedAt as string) ?? null,
    whatsappJid: (d.whatsappJid as string) ?? null,
    isPrimary: Boolean(d.isPrimary),
    discoveredVia: (d.discoveredVia as ProspectContact["discoveredVia"]) ?? "manual",
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateProspectContactInput {
  prospectId: string;
  name?: string | null;
  role?: string | null;
  phone: string;
  isPrimary?: boolean;
  discoveredVia?: ProspectContact["discoveredVia"];
}

/** §5.2 — Winston's own example (reception / ops manager / owner, each with their own number). Setting isPrimary unsets it on every other contact for the same prospect first. */
export async function createProspectContact(input: CreateProspectContactInput): Promise<ProspectContact> {
  const db = getAdminFirestore();
  if (input.isPrimary) {
    const existing = await db.collection(PROSPECT_CONTACTS).where("prospectId", "==", input.prospectId).limit(200).get();
    for (const doc of existing.docs) {
      if (doc.data().isPrimary) await doc.ref.update({ isPrimary: false });
    }
  }
  const ref = await db.collection(PROSPECT_CONTACTS).add({
    prospectId: input.prospectId,
    name: input.name ?? null,
    role: input.role ?? null,
    phone: input.phone,
    whatsappStatus: "unknown" satisfies WhatsAppNumberStatus,
    whatsappVerifiedAt: null,
    whatsappJid: null,
    isPrimary: input.isPrimary ?? false,
    discoveredVia: input.discoveredVia ?? "manual",
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  return prospectContactFromDoc(doc);
}

export async function listProspectContacts(prospectId: string): Promise<ProspectContact[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(PROSPECT_CONTACTS).where("prospectId", "==", prospectId).limit(200).get();
  return snapshot.docs.map(prospectContactFromDoc).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getProspectContact(id: string): Promise<ProspectContact | null> {
  const doc = await getAdminFirestore().collection(PROSPECT_CONTACTS).doc(id).get();
  return doc.exists ? prospectContactFromDoc(doc) : null;
}

export interface UpdateProspectContactInput {
  name?: string | null;
  role?: string | null;
  whatsappStatus?: WhatsAppNumberStatus;
  whatsappVerifiedAt?: string | null;
  whatsappJid?: string | null;
}

export async function updateProspectContact(id: string, patch: UpdateProspectContactInput): Promise<void> {
  await getAdminFirestore().collection(PROSPECT_CONTACTS).doc(id).update({ ...patch });
}

function conversationFromDoc(doc: DocumentSnapshot): WhatsAppConversation {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    prospectContactId: (d.prospectContactId as string) ?? null,
    whatsappJid: (d.whatsappJid as string) ?? "",
    state: (d.state as ConversationState) ?? "new",
    lastMessageAt: (d.lastMessageAt as string) ?? null,
    lastMessagePreview: (d.lastMessagePreview as string) ?? null,
    unreadCount: (d.unreadCount as number) ?? 0,
    requiresResponse: Boolean(d.requiresResponse),
    responseUrgency: (d.responseUrgency as WhatsAppConversation["responseUrgency"]) ?? null,
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
    updatedAt: tsToIso(d.updatedAt) ?? tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export async function listWhatsAppConversations(filters: { requiresResponse?: boolean } = {}): Promise<WhatsAppConversation[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(WHATSAPP_CONVERSATIONS).orderBy("updatedAt", "desc").limit(1000).get();
  let conversations = snapshot.docs.map(conversationFromDoc);
  if (filters.requiresResponse !== undefined) conversations = conversations.filter((c) => c.requiresResponse === filters.requiresResponse);
  return conversations;
}

export async function getWhatsAppConversation(id: string): Promise<WhatsAppConversation | null> {
  const doc = await getAdminFirestore().collection(WHATSAPP_CONVERSATIONS).doc(id).get();
  return doc.exists ? conversationFromDoc(doc) : null;
}

export async function listConversationsForProspect(prospectId: string): Promise<WhatsAppConversation[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(WHATSAPP_CONVERSATIONS).where("prospectId", "==", prospectId).limit(50).get();
  return snapshot.docs.map(conversationFromDoc).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** §7 — one conversation per (prospectId, whatsappJid); found or created on the very first inbound/outbound message. */
export async function getOrCreateConversation(prospectId: string, whatsappJid: string, prospectContactId: string | null = null): Promise<WhatsAppConversation> {
  const db = getAdminFirestore();
  const existing = await db
    .collection(WHATSAPP_CONVERSATIONS)
    .where("prospectId", "==", prospectId)
    .limit(50)
    .get();
  const match = existing.docs.find((doc) => doc.data().whatsappJid === whatsappJid);
  if (match) return conversationFromDoc(match);

  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(WHATSAPP_CONVERSATIONS).add({
    prospectId,
    prospectContactId,
    whatsappJid,
    state: "new" satisfies ConversationState,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 0,
    requiresResponse: false,
    responseUrgency: null,
    createdAt: now,
    updatedAt: now,
  });
  const doc = await ref.get();
  return conversationFromDoc(doc);
}

export interface UpdateConversationInput {
  state?: ConversationState;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  requiresResponse?: boolean;
  responseUrgency?: WhatsAppConversation["responseUrgency"];
}

/** §9 — every state transition also gets a "whatsapp_conversation_state_changed" AuditEvent; callers pass evidence for that log entry. */
export async function updateWhatsAppConversation(id: string, patch: UpdateConversationInput, stateChangeEvidence?: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(WHATSAPP_CONVERSATIONS).doc(id);
  const before = await ref.get();
  const fromState = (before.data()?.state as ConversationState) ?? "new";

  await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });

  if (patch.state && patch.state !== fromState) {
    const prospectId = (before.data()?.prospectId as string) ?? null;
    await createAuditEvent({
      eventType: "whatsapp_conversation_state_changed",
      summary: `WhatsApp conversation moved ${fromState} → ${patch.state}`,
      relatedProspectId: prospectId,
      actor: "ai_inbox_extraction",
      metadata: { conversationId: id, from: fromState, to: patch.state, evidence: stateChangeEvidence ?? null },
    });
    if (prospectId) await invalidateProspectContext(prospectId);
  }
}

function messageFromDoc(doc: DocumentSnapshot): WhatsAppMessage {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    conversationId: (d.conversationId as string) ?? "",
    waMessageId: (d.waMessageId as string) ?? "",
    senderType: (d.senderType as WhatsAppMessageSenderType) ?? "prospect",
    body: (d.body as string) ?? null,
    mediaUrl: (d.mediaUrl as string) ?? null,
    mediaMimeType: (d.mediaMimeType as string) ?? null,
    whatsappTimestamp: (d.whatsappTimestamp as string) ?? new Date(0).toISOString(),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateWhatsAppMessageInput {
  conversationId: string;
  waMessageId: string;
  senderType: WhatsAppMessageSenderType;
  body: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  whatsappTimestamp: string;
}

/** §5.3/Zuri's own dedupe key — (conversationId, waMessageId). A duplicate delivery of the same webhook event is a silent no-op, not a second row. */
export async function createWhatsAppMessage(input: CreateWhatsAppMessageInput): Promise<WhatsAppMessage> {
  const db = getAdminFirestore();
  const existing = await db
    .collection(WHATSAPP_MESSAGES)
    .where("conversationId", "==", input.conversationId)
    .limit(500)
    .get();
  const duplicate = existing.docs.find((doc) => doc.data().waMessageId === input.waMessageId);
  if (duplicate) return messageFromDoc(duplicate);

  const ref = await db.collection(WHATSAPP_MESSAGES).add({
    conversationId: input.conversationId,
    waMessageId: input.waMessageId,
    senderType: input.senderType,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    mediaMimeType: input.mediaMimeType ?? null,
    whatsappTimestamp: input.whatsappTimestamp,
    createdAt: FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  return messageFromDoc(doc);
}

export async function listWhatsAppMessages(conversationId: string, limitCount = 200): Promise<WhatsAppMessage[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(WHATSAPP_MESSAGES).where("conversationId", "==", conversationId).limit(limitCount).get();
  return snapshot.docs.map(messageFromDoc).sort((a, b) => (a.whatsappTimestamp < b.whatsappTimestamp ? -1 : 1));
}

/** The Inbox's own reply-composer needs "has the prospect replied since my last send" (see the cooldown carve-out in whatsapp/send/route.ts), not the full thread — this is the one extra query that answers it. */
export async function getLastMessageForConversation(conversationId: string): Promise<WhatsAppMessage | null> {
  const messages = await listWhatsAppMessages(conversationId, 500);
  if (messages.length === 0) return null;
  return messages[messages.length - 1];
}

/** The Inbox marks a conversation read the moment Winston opens it — resets the badge and clears requiresResponse, since he's looking at it right now. */
export async function markConversationRead(id: string): Promise<void> {
  await getAdminFirestore().collection(WHATSAPP_CONVERSATIONS).doc(id).update({ unreadCount: 0, requiresResponse: false });
}

function analysisFromDoc(doc: DocumentSnapshot): WhatsAppMessageAnalysis {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    messageId: (d.messageId as string) ?? "",
    sentiment: (d.sentiment as WhatsAppMessageAnalysis["sentiment"]) ?? "neutral",
    intentCategory: (d.intentCategory as string) ?? "unknown",
    intentConfidence: (d.intentConfidence as number) ?? 0,
    entities: Array.isArray(d.entities) ? (d.entities as WhatsAppEntity[]) : [],
    buyingSignals: Array.isArray(d.buyingSignals) ? (d.buyingSignals as BuyingSignalType[]) : [],
    requiresResponse: Boolean(d.requiresResponse),
    responseUrgency: (d.responseUrgency as WhatsAppMessageAnalysis["responseUrgency"]) ?? "low",
    summary: (d.summary as string) ?? "",
    suggestedConversationState: (d.suggestedConversationState as ConversationState) ?? null,
    analyzedAt: (d.analyzedAt as string) ?? new Date().toISOString(),
  };
}

export interface CreateWhatsAppMessageAnalysisInput {
  messageId: string;
  sentiment: WhatsAppMessageAnalysis["sentiment"];
  intentCategory: string;
  intentConfidence: number;
  entities: WhatsAppEntity[];
  buyingSignals: BuyingSignalType[];
  requiresResponse: boolean;
  responseUrgency: WhatsAppMessageAnalysis["responseUrgency"];
  summary: string;
  suggestedConversationState: ConversationState | null;
}

/** §7/§10 — written directly, no human-approval gate: this is metadata/scoring (sentiment, urgency, buying signals → opportunityScore), not a facts/tasks/decisions write, which stays gated via the Inbox's review-then-apply path. */
export async function createWhatsAppMessageAnalysis(input: CreateWhatsAppMessageAnalysisInput): Promise<WhatsAppMessageAnalysis> {
  const db = getAdminFirestore();
  const ref = await db.collection(WHATSAPP_MESSAGE_ANALYSES).add({
    messageId: input.messageId,
    sentiment: input.sentiment,
    intentCategory: input.intentCategory,
    intentConfidence: input.intentConfidence,
    entities: input.entities,
    buyingSignals: input.buyingSignals,
    requiresResponse: input.requiresResponse,
    responseUrgency: input.responseUrgency,
    summary: input.summary,
    suggestedConversationState: input.suggestedConversationState,
    analyzedAt: new Date().toISOString(),
  });
  const doc = await ref.get();
  return analysisFromDoc(doc);
}

function whatsAppSendFromDoc(doc: DocumentSnapshot): WhatsAppSend {
  const d = doc.data() ?? {};
  return {
    id: doc.id,
    prospectId: (d.prospectId as string) ?? "",
    conversationId: (d.conversationId as string) ?? null,
    recipientJid: (d.recipientJid as string) ?? "",
    messageBody: (d.messageBody as string) ?? "",
    isFirstOutreach: Boolean(d.isFirstOutreach),
    approvedBy: "winston",
    status: (d.status as WhatsAppSendStatus) ?? "failed",
    errorMessage: (d.errorMessage as string) ?? null,
    sentAt: tsToIso(d.sentAt) ?? new Date(0).toISOString(),
    createdAt: tsToIso(d.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface CreateWhatsAppSendInput {
  prospectId: string;
  conversationId: string | null;
  recipientJid: string;
  messageBody: string;
  isFirstOutreach: boolean;
  status: WhatsAppSendStatus;
  errorMessage?: string | null;
}

export async function createWhatsAppSend(input: CreateWhatsAppSendInput): Promise<WhatsAppSend> {
  const db = getAdminFirestore();
  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(WHATSAPP_SENDS).add({
    prospectId: input.prospectId,
    conversationId: input.conversationId,
    recipientJid: input.recipientJid,
    messageBody: input.messageBody,
    isFirstOutreach: input.isFirstOutreach,
    approvedBy: "winston",
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    sentAt: now,
    createdAt: now,
  });
  const doc = await ref.get();
  return whatsAppSendFromDoc(doc);
}

export interface ListWhatsAppSendsFilters {
  prospectId?: string;
  limit?: number;
}

export async function listWhatsAppSends(filters: ListWhatsAppSendsFilters = {}): Promise<WhatsAppSend[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(WHATSAPP_SENDS)
    .orderBy("createdAt", "desc")
    .limit(filters.limit ?? 2000)
    .get();
  let sends = snapshot.docs.map(whatsAppSendFromDoc);
  if (filters.prospectId) sends = sends.filter((s) => s.prospectId === filters.prospectId);
  return sends;
}

/** §11's daily cap — same "only successful sends count" reasoning as countEmailSendsToday(). */
export async function countWhatsAppSendsToday(): Promise<number> {
  const sends = await listWhatsAppSends({ limit: 2000 });
  const today = new Date().toISOString().slice(0, 10);
  return sends.filter((s) => s.status === "sent" && s.createdAt.slice(0, 10) === today).length;
}

/** §11's per-prospect cooldown — null if this would be the first-ever send to this prospect (also the isFirstOutreach signal §8's permanent Level-0 floor keys off). */
export async function getLastWhatsAppSendForProspect(prospectId: string): Promise<WhatsAppSend | null> {
  const sends = await listWhatsAppSends({ prospectId, limit: 500 });
  const sent = sends.filter((s) => s.status === "sent");
  if (sent.length === 0) return null;
  return sent.reduce((latest, s) => (s.createdAt > latest.createdAt ? s : latest));
}
