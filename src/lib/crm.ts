import "server-only";
import { FieldValue, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebaseAdmin";
import { classifyZambianPhone } from "./phoneRules";
import { PROSPECT_SEED_ROWS } from "./prospectSeedData";
import type {
  Interaction,
  InteractionOutcome,
  InteractionType,
  PipelineStage,
  PhoneClassification,
  Prospect,
  ProspectIntelligence,
  ProspectSource,
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
}

export async function listProspects(filters: ListProspectsFilters = {}): Promise<Prospect[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(PROSPECTS).orderBy("createdAt", "desc").limit(1000).get();
  let prospects = snapshot.docs.map(prospectFromDoc);

  if (!filters.includeArchived) prospects = prospects.filter((p) => !p.archivedAt);
  if (filters.stage !== undefined) prospects = prospects.filter((p) => p.stage === filters.stage);
  if (filters.source) prospects = prospects.filter((p) => p.source === filters.source);
  if (filters.dueBy) prospects = prospects.filter((p) => p.nextActionDate !== null && p.nextActionDate <= filters.dueBy!);

  return prospects;
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const doc = await getAdminFirestore().collection(PROSPECTS).doc(id).get();
  return doc.exists ? prospectFromDoc(doc) : null;
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
