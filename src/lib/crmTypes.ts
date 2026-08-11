/**
 * DeployFleet's own internal Revenue OS — the CRM/pipeline vocabulary
 * from the GTM Strategy / Sales Playbook / Operating Rhythm briefs,
 * distinct from Visitor Intelligence 2.0 (visitorTypes.ts), which tracks
 * website visitors, not DeployFleet's own outbound/inbound sales
 * pipeline. Pure types, no Firebase imports — safe from both server
 * code (crm.ts) and client Tab components.
 */

/** Brief #14's clean 13-stage pipeline (0-12), not the earlier 8-stage draft this project briefly scratch-built and discarded. */
export type PipelineStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  0: "Unqualified",
  1: "Researched",
  2: "Contact Attempted",
  3: "First Contact",
  4: "Discovery",
  5: "Qualified Opportunity",
  6: "Demo Scheduled",
  7: "Demo Completed",
  8: "Proposal",
  9: "Negotiation",
  10: "Won",
  11: "Lost",
  12: "Nurture",
};

export const PIPELINE_STAGES: PipelineStage[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Brief #15 — "attempted" is not the same kind of fact as "stage"; kept as its own field so a stalled stage never masks what actually happened on the last touch. */
export type InteractionOutcome =
  | "no-answer"
  | "gatekeeper"
  | "wrong-person"
  | "right-person"
  | "meaningful-conversation"
  | "demo-booked"
  | "other";

export const INTERACTION_OUTCOME_LABEL: Record<InteractionOutcome, string> = {
  "no-answer": "No answer",
  gatekeeper: "Gatekeeper",
  "wrong-person": "Wrong person",
  "right-person": "Right person",
  "meaningful-conversation": "Meaningful conversation",
  "demo-booked": "Demo booked",
  other: "Other",
};

export type InteractionType = "call" | "whatsapp" | "email" | "visit" | "demo" | "note";

export const INTERACTION_TYPE_LABEL: Record<InteractionType, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Depot visit",
  demo: "Demo",
  note: "Note",
};

export type ProspectSource =
  | "outbound-cold-list"
  | "inbound-contact-form"
  | "inbound-homepage-cta"
  | "inbound-demo-gate"
  | "referral"
  | "other";

export const PROSPECT_SOURCE_LABEL: Record<ProspectSource, string> = {
  "outbound-cold-list": "Outbound — cold list",
  "inbound-contact-form": "Inbound — contact form",
  "inbound-homepage-cta": "Inbound — homepage CTA",
  "inbound-demo-gate": "Inbound — demo gate",
  referral: "Referral",
  other: "Other",
};

/** Brief #4/#33 — DeployFleet's own hierarchy: human-confirmed beats reliable external evidence beats AI inference beats a campaign assumption. */
export type IntelligenceSourceType = "human_confirmed" | "ai_research" | "system_rule" | "campaign";

export interface IntelligenceField<T> {
  value: T;
  source: string;
  sourceType: IntelligenceSourceType;
  confidence: number | null;
  verified: boolean;
  generatedAt: string;
}

/** Brief #4's structured SDR brief output shape — every field optional since a prospect may not have a brief generated yet. */
export interface ProspectIntelligence {
  fleetTier?: IntelligenceField<string>;
  priorityScore?: IntelligenceField<number>;
  likelyPain?: IntelligenceField<string>;
  recommendedWedge?: IntelligenceField<string>;
  recommendedChannel?: IntelligenceField<string>;
  discoveryQuestion?: IntelligenceField<string>;
  summary?: IntelligenceField<string>;
}

/** Brief #8's phone verification service output — a channel recommendation, not a hard block (a pattern-anomaly flag is never treated as "invalid" on its own). */
export interface PhoneClassification {
  type: "landline" | "mobile" | "unknown";
  carrier: "Airtel" | "MTN" | null;
  recommendedChannel: "call" | "whatsapp";
  patternAnomaly: boolean;
}

/** A snapshot of the linked Visitor Intelligence record, taken at promotion time (not live-refreshed) — see crm.ts's syncLeadsToProspects(). */
export interface VisitorSnapshot {
  visitorId: string;
  engagementScore: number;
  intentScore: number;
  totalSessions: number;
  totalPageViews: number;
  topPages: string[];
  lastSeenAt: string;
  firstLandingPage: string | null;
  lastReferrerType: string;
}

export interface Prospect {
  id: string;
  name: string;
  contactName: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  location: string | null;
  estimatedFleetSizeRaw: string | null;
  primaryPainRaw: string | null;

  phoneClassification: PhoneClassification | null;

  source: ProspectSource;
  stage: PipelineStage;
  lastInteractionOutcome: InteractionOutcome | null;
  lastInteractionSummary: string | null;
  lastContactDate: string | null;

  /** Brief #6, non-negotiable per the Sales Playbook: every active prospect must have both set. */
  nextActionDate: string | null;
  nextActionType: InteractionType | null;
  nextActionNote: string | null;

  priorityScore: number | null;
  intelligence: ProspectIntelligence;

  /** Set only when this prospect was promoted from a website form submission — see crm.ts's syncLeadsToProspects(). */
  linkedLeadId: string | null;
  linkedVisitorId: string | null;
  visitorSnapshot: VisitorSnapshot | null;

  flags: string[];
  createdAt: string;
  updatedAt: string;
  /** Brief #6's Friday Pipeline Cleanse — archives, never deletes. */
  archivedAt: string | null;
}

export interface Interaction {
  id: string;
  prospectId: string;
  type: InteractionType;
  outcome: InteractionOutcome | null;
  rawNote: string | null;
  aiExtracted: {
    stage: PipelineStage | null;
    pain: string | null;
    nextActionDate: string | null;
    nextActionType: InteractionType | null;
  } | null;
  createdAt: string;
  createdBy: string;
}
