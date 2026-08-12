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

  /** Phase 0 — see docs/ai-marketing-os-architecture.md §4.7/§6.3. Named "Outreach" in the UI to avoid colliding with the separate Visitor Intelligence "Campaigns" (website traffic channels) concept. */
  campaignId: string | null;

  /** Phase 1 §4.1 — deliberately separate from priorityScore ("how ready to buy"): icpFitScore is "how good a fit," opportunityScore is "how big." Null until an AI brief or Winston sets them; not derived from priorityScore. */
  icpFitScore: number | null;
  opportunityScore: number | null;
  /** e.g. "no-decision-maker-identified", "stalled-14-days" — written by the Reality & Reconciliation Engine (§7.5) and/or Winston directly. */
  riskFlags: string[];

  flags: string[];
  createdAt: string;
  updatedAt: string;
  /** Brief #6's Friday Pipeline Cleanse — archives, never deletes. */
  archivedAt: string | null;

  /**
   * WhatsApp Intelligence, docs/whatsapp-intelligence-architecture.md §5.1
   * / §6. Freshness-bounded, never permanent truth — see checkAvailability()
   * in gatewayClient.ts and POST /api/admin/crm/whatsapp/verify. "unknown"
   * is the default for every prospect until a real check runs — never
   * inferred from phoneClassification's rule-based guess.
   */
  whatsappStatus: WhatsAppNumberStatus;
  whatsappVerifiedAt: string | null;
  whatsappJid: string | null;
  /** §11 — a message matching an opt-out pattern sets this permanently; the send path refuses unconditionally once set, no override. */
  whatsappOptedOut: boolean;
}

/**
 * Phase 1 §4.2 — the append-only ledger underneath ProspectIntelligence.
 * ProspectIntelligence stays the compact "current best answer" a UI reads
 * without a second query; `facts` is the full history the Reality Engine
 * and Inbox extraction pipeline write to. `value` is deliberately a free
 * string, not typed per-key — see the architecture doc §12 on why a
 * generic ledger covering arbitrary extracted attributes can't have a
 * fixed TypeScript shape the way ProspectIntelligence's named fields do.
 */
export type FactLifecycleStatus = "new" | "active" | "confirmed" | "stale" | "reconciliation_required" | "superseded";
export type FactType = "prospect_attribute" | "contact_info" | "pain_point" | "competitive" | "operational" | "other";

export const FACT_TYPE_LABEL: Record<FactType, string> = {
  prospect_attribute: "Prospect attribute",
  contact_info: "Contact info",
  pain_point: "Pain point",
  competitive: "Competitive",
  operational: "Operational",
  other: "Other",
};

export interface Fact {
  id: string;
  prospectId: string;
  factType: FactType;
  /** e.g. "fleetSize", "decisionMaker", "currentTool" */
  key: string;
  value: string;
  /** e.g. "AI SDR conversation, 11 Aug", "Winston direct" */
  source: string;
  sourceType: IntelligenceSourceType;
  confidence: number | null;
  status: FactLifecycleStatus;
  /** Fact id this replaces, if any. */
  supersedes: string | null;
  /** Set when a newer Fact replaces this one. */
  supersededBy: string | null;
  verifiedAt: string | null;
  /** The Reality Engine (§7.5) updates this on every reconciliation pass. */
  lastCheckedAt: string;
  createdAt: string;
}

/** Phase 1 §4.3 — generalizes beyond Prospect.nextActionDate/nextActionType (which stay — /admin/today still reads them) into a real, AI-creatable task entity not always prospect-shaped. */
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskCreatedBy = "human" | "ai_orchestrator" | "ai_reconciliation" | "ai_inbox_extraction" | "whatsapp_intelligence";
export type TaskPriority = "low" | "medium" | "high";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

/** Phase 3 §9's end-of-day review — the forced classification for any task still incomplete at review time. Modeled as a field directly on Task rather than a new Fact-like construct scoped to Winston himself, per the architecture doc's own "modeling decision to make when this phase starts" — the simpler, more consistent-with-existing-patterns choice. */
export type TaskIncompleteReason = "no-answer" | "bad-data" | "blocked" | "forgot" | "low-priority" | "avoided" | "other";

export const TASK_INCOMPLETE_REASON_LABEL: Record<TaskIncompleteReason, string> = {
  "no-answer": "No answer / couldn't reach them",
  "bad-data": "Bad contact info",
  blocked: "Blocked on something else",
  forgot: "Forgot",
  "low-priority": "Deprioritized for something more urgent",
  avoided: "Avoided it",
  other: "Other",
};

export interface Task {
  id: string;
  title: string;
  description: string | null;
  relatedProspectId: string | null;
  /** Phase 1 §4.6 — assigned to an AI employee, not Winston. */
  relatedEmployeeId: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: TaskCreatedBy;
  /** Phase 1 §4.5 — provenance back to the pasted text this came from. */
  sourceInboxEntryId: string | null;
  /** Phase 3 §9 — set only when Winston classifies this task during an end-of-day review while it's still incomplete. */
  incompleteReason: TaskIncompleteReason | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Phase 1 §4.4 — the Decision Ledger. Never deleted, only superseded — same "archive, don't delete" discipline as Prospect.archivedAt. */
export type DecisionStatus = "active" | "superseded";
export type DecisionScope = { type: "global" } | { type: "prospect"; prospectId: string } | { type: "employee"; employeeId: string };

export interface Decision {
  id: string;
  /** e.g. "Prioritize trucking companies with 15+ vehicles" */
  decisionText: string;
  reason: string;
  scope: DecisionScope;
  /** Free-text citations, or Fact/Interaction ids. */
  evidence: string[];
  status: DecisionStatus;
  /** Decision id this replaces, if any. */
  supersedes: string | null;
  supersededBy: string | null;
  madeBy: "winston" | "ai_orchestrator";
  createdAt: string;
}

/** Phase 1 §4.5 — the AI Inbox's raw, immutable record of what was pasted. A "conversation" is just this employee's inboxEntries in order — no separate collection. */
export type InboxSourceType =
  | "ai_sdr"
  | "ai_researcher"
  | "ai_sales_coach"
  | "ai_market_intelligence"
  | "ai_seo"
  | "ai_content"
  | "ai_analyst"
  | "winston_direct"
  | "call_transcript"
  | "whatsapp_conversation";

export const INBOX_SOURCE_TYPE_LABEL: Record<InboxSourceType, string> = {
  ai_sdr: "AI SDR",
  ai_researcher: "AI Researcher",
  ai_sales_coach: "AI Sales Coach",
  ai_market_intelligence: "AI Market Intelligence",
  ai_seo: "AI SEO",
  ai_content: "AI Content",
  ai_analyst: "AI Analyst",
  winston_direct: "Winston (direct note)",
  call_transcript: "Call transcript",
  whatsapp_conversation: "WhatsApp conversation",
};

export interface ExtractedFact {
  key: string;
  value: string;
  /** A name string the model extracted, not a Firestore id — resolved server-side against existing prospects. */
  prospectRef: string | null;
  confidence: number | null;
}

export interface ExtractedTask {
  title: string;
  dueDate: string | null;
  prospectRef: string | null;
}

export interface ExtractedDecision {
  decisionText: string;
  reason: string;
}

export interface ExtractedContradiction {
  field: string;
  existingValue: string;
  newValue: string;
}

/** §7.1's extraction shape — every array optional/empty-safe, since most pasted text won't hit every category. */
export interface ExtractionResult {
  facts: ExtractedFact[];
  tasks: ExtractedTask[];
  decisions: ExtractedDecision[];
  risks: string[];
  recommendations: string[];
  contradictions: ExtractedContradiction[];
  /** Sales Coach specialization (§6.4) — only present when sourceType is "call_transcript". */
  callAnalysis: CallAnalysis | null;
}

/** §6.4 — the Sales Coach's dedicated output shape, alongside generic fact/task/decision extraction. */
export interface CallAnalysis {
  whatWentWell: string[];
  missedOpportunities: string[];
  objectionsRaised: string[];
  recommendedNextQuestion: string | null;
}

export type ExtractionStatus = "pending" | "processed" | "failed";

export interface InboxEntry {
  id: string;
  rawText: string;
  sourceType: InboxSourceType;
  /** Set when pasted from a prospect-specific tab (§7.2). */
  relatedProspectId: string | null;
  /** Set when pasted from an employee's tab (§7.3). */
  relatedEmployeeId: string | null;
  pastedAt: string;
  extractionStatus: ExtractionStatus;
  extractionResult: ExtractionResult | null;
  reviewedByWinston: boolean;
  createdAt: string;
}

/** Phase 1 §4.6 — the Team page's backing data. A persona Winston pastes conversations on behalf of, not a live autonomous agent — see the architecture doc §12. */
export type AiEmployeeStatus = "active" | "paused";

export interface AiEmployee {
  id: string;
  /** "Charity", etc. — Winston is the human; these are the AI personas. */
  name: string;
  /** "AI SDR", "AI Researcher", "AI Sales Coach", ... */
  role: string;
  mission: string;
  status: AiEmployeeStatus;
  /** Standing instructions Winston has given this persona. */
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

/** Phase 1 §4.8 — the system-wide activity feed and the audit trail the Decision Ledger's own reasoning depends on. Append-only, never edited or deleted. */
export type AuditEventType =
  | "fact_created"
  | "fact_superseded"
  | "task_created"
  | "task_completed"
  | "decision_made"
  | "decision_superseded"
  | "prospect_updated"
  | "reconciliation_flag_raised"
  | "ai_brief_generated"
  | "inbox_entry_processed"
  | "email_sent"
  | "whatsapp_verified"
  | "whatsapp_sent"
  | "whatsapp_message_received"
  | "whatsapp_conversation_state_changed";

export type AuditEventActor = "winston" | "ai_orchestrator" | "ai_reconciliation" | "ai_inbox_extraction" | "whatsapp_intelligence";

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  /** Human-readable, e.g. "Updated Yeshua Logistics fleet size: 25 -> 18" */
  summary: string;
  relatedProspectId: string | null;
  relatedEmployeeId: string | null;
  actor: AuditEventActor;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Phase 0 — "Outreach" in the UI. A batch of outbound activity with its own attempt/meaningful-interaction targets, e.g. "August Outbound Offensive" — the brief's own "DeployFleet — Today's 10" example, made a real entity instead of an implicit daily habit. */
export type CampaignStatus = "active" | "completed" | "archived";

export interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  targetAttempts: number | null;
  targetMeaningfulInteractions: number | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
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

/**
 * The outbound half of the email channel (docs/email-templates.md) —
 * one row per send attempt, whether it succeeded or not, so the 20/day
 * cap (enforced server-side, never trusted to the client) can be counted
 * accurately and a failed send is still visible in a prospect's history.
 */
export type EmailTemplateKey = "cold_outreach" | "followup" | "custom";
export type EmailSendStatus = "sent" | "failed";

export const EMAIL_TEMPLATE_LABEL: Record<EmailTemplateKey, string> = {
  cold_outreach: "Cold Outreach",
  followup: "Follow-up",
  custom: "Custom",
};

export interface EmailSend {
  id: string;
  prospectId: string;
  recipientEmail: string;
  template: EmailTemplateKey;
  campaignId: string | null;
  status: EmailSendStatus;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// WhatsApp Intelligence & Outreach Automation
// docs/whatsapp-intelligence-architecture.md — Phase 4 of the AI Marketing
// OS. Same conventions as every collection above: createdAt/updatedAt as
// Timestamp at the storage layer, ISO strings at this type layer, flat
// collections filtered in memory (§15's resolved "flat vs nested" call).
// ---------------------------------------------------------------------------

/** §6 — never permanent truth; re-checked on a freshness window (30 days default) and always immediately before outreach regardless of staleness. */
export type WhatsAppNumberStatus = "verified" | "unavailable" | "unknown";

/** §5.2 — a prospect can have more than one real-world contact (reception, ops manager, owner), each with their own number/WhatsApp status. */
export interface ProspectContact {
  id: string;
  prospectId: string;
  name: string | null;
  role: string | null;
  phone: string;
  whatsappStatus: WhatsAppNumberStatus;
  whatsappVerifiedAt: string | null;
  whatsappJid: string | null;
  isPrimary: boolean;
  discoveredVia: "manual" | "whatsapp_referral" | "ai_inbox_extraction";
  createdAt: string;
}

/** §9 — Winston's own state machine, adopted as specified. Purely observational relative to Prospect.stage (§15) — nothing here ever writes the pipeline stage automatically. */
export type ConversationState =
  | "new"
  | "outreach_sent"
  | "awaiting_response"
  | "responded"
  | "qualification"
  | "discovery"
  | "interested"
  | "demo_requested"
  | "demo_scheduled"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "nurture"
  | "closed"
  | "waiting_for_human_action";

export const CONVERSATION_STATE_LABEL: Record<ConversationState, string> = {
  new: "New",
  outreach_sent: "Outreach sent",
  awaiting_response: "Awaiting response",
  responded: "Responded",
  qualification: "Qualification",
  discovery: "Discovery",
  interested: "Interested",
  demo_requested: "Demo requested",
  demo_scheduled: "Demo scheduled",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
  closed: "Closed",
  waiting_for_human_action: "Waiting on Winston",
};

export interface WhatsAppConversation {
  id: string;
  prospectId: string;
  prospectContactId: string | null;
  whatsappJid: string;
  state: ConversationState;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  requiresResponse: boolean;
  responseUrgency: "low" | "medium" | "high" | "urgent" | null;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppMessageSenderType = "prospect" | "winston" | "ai_draft";

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  waMessageId: string;
  senderType: WhatsAppMessageSenderType;
  body: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  whatsappTimestamp: string;
  createdAt: string;
}

/** §10 — a fixed, hand-written registry, never a freeform LLM-classified string. */
export type BuyingSignalType =
  | "pricing_inquiry"
  | "demo_request"
  | "fleet_size_disclosed"
  | "internal_referral"
  | "pain_point_admission"
  | "explicit_commitment"
  | "competitor_mentioned"
  | "budget_mentioned";

export const BUYING_SIGNAL_LABEL: Record<BuyingSignalType, string> = {
  pricing_inquiry: "Pricing inquiry",
  demo_request: "Demo request",
  fleet_size_disclosed: "Fleet size disclosed",
  internal_referral: "Internal referral",
  pain_point_admission: "Pain point admission",
  explicit_commitment: "Explicit commitment",
  competitor_mentioned: "Competitor mentioned",
  budget_mentioned: "Budget mentioned",
};

export interface WhatsAppEntity {
  type: string;
  value: string;
}

export interface WhatsAppMessageAnalysis {
  id: string;
  messageId: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  intentCategory: string;
  intentConfidence: number;
  entities: WhatsAppEntity[];
  buyingSignals: BuyingSignalType[];
  requiresResponse: boolean;
  responseUrgency: "low" | "medium" | "high" | "urgent";
  summary: string;
  suggestedConversationState: ConversationState | null;
  analyzedAt: string;
}

/** §5.4/§11 — modeled directly on EmailSend: every attempt logged, only successful sends count against the daily cap. */
export type WhatsAppSendStatus = "sent" | "failed";

export interface WhatsAppSend {
  id: string;
  prospectId: string;
  conversationId: string | null;
  recipientJid: string;
  messageBody: string;
  isFirstOutreach: boolean;
  approvedBy: "winston";
  status: WhatsAppSendStatus;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Revenue OS — Directives & Daily Goals (RS-0)
// docs/revenue-os-architecture.md §4.1, §4.3. The "Direct" and target
// halves of the Daily Command Center's Command Strip. Pure types only —
// the Directive store is Firestore (crm.ts), the GoalsConfig store is the
// diesel-price-style KeyValueStore (goals.ts).
// ---------------------------------------------------------------------------

/** §4.1 — a CEO/company objective. Multiple may be active at once (confirmed by Winston); never AI-authored. */
export type DirectiveStatus = "active" | "archived";

export interface Directive {
  id: string;
  /** e.g. "Primary company objective". */
  title: string;
  /** Free text — strategic priorities, constraints, explicit asks. */
  body: string;
  /** ISO Monday date when this is a weekly objective; null for a standing/primary directive. */
  weekOf: string | null;
  status: DirectiveStatus;
  createdBy: "winston";
  createdAt: string;
  updatedAt: string;
}

/**
 * §4.3 — the configurable daily goal set. Replaces the two hardcoded
 * TARGET_ATTEMPTS_PER_DAY/TARGET_MEANINGFUL_PER_DAY constants with a
 * richer, per-weekday-overridable object. `prospects` is the primary
 * "attempts" target the weekly scoreboard/SystemState already tracked;
 * the rest are the brief's own §8 sub-buckets.
 */
export interface DailyGoalSet {
  /** Distinct prospects worked in a day — the primary "attempts" target. */
  prospects: number;
  meaningfulConversations: number;
  calls: number;
  whatsapp: number;
  emails: number;
  followUps: number;
  demos: number;
  researchActions: number;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Keyed 0 (Sunday) – 6 (Saturday); a weekday with no override falls back
 * to `default`. Stored under a single GOALS_CONFIG key via getStore(),
 * exactly the diesel-price precedent — not a Firestore collection.
 */
export interface GoalsConfig {
  default: DailyGoalSet;
  overrides: Partial<Record<Weekday, Partial<DailyGoalSet>>>;
  updatedAt: string;
}

/** The shipped defaults — the two numbers Winston already validated (10 attempts / 5 meaningful), plus modest starting points for the new sub-buckets, all tunable on /admin/settings/daily-goals. */
export const DEFAULT_DAILY_GOALS: DailyGoalSet = {
  prospects: 10,
  meaningfulConversations: 5,
  calls: 6,
  whatsapp: 6,
  emails: 4,
  followUps: 3,
  demos: 1,
  researchActions: 2,
};

/** Ordered for stable UI rendering + human labels for each goal field. */
export const DAILY_GOAL_FIELDS: { key: keyof DailyGoalSet; label: string; tracked: boolean }[] = [
  { key: "prospects", label: "Prospects worked", tracked: true },
  { key: "meaningfulConversations", label: "Meaningful conversations", tracked: true },
  { key: "calls", label: "Calls", tracked: true },
  { key: "whatsapp", label: "WhatsApp", tracked: true },
  { key: "emails", label: "Emails", tracked: true },
  { key: "demos", label: "Demos", tracked: true },
  { key: "followUps", label: "Follow-ups", tracked: false },
  { key: "researchActions", label: "Research actions", tracked: false },
];

// ---------------------------------------------------------------------------
// Revenue OS RS-1 — Daily Prospect Ranking (docs/revenue-os-architecture.md
// §5.7, §4.4). A deterministic weighted score over existing fields, computed
// fresh on every Today load — NOT a stored entity. Weights are editable
// config (getStore, same as goals). AI, when configured, only re-ranks the
// top deterministic candidates; it never computes the base score (§6).
// ---------------------------------------------------------------------------

export type RankComponent =
  | "icpFit"
  | "engagement"
  | "followUpUrgency"
  | "buyingIntent"
  | "strategicRelevance"
  | "contactability"
  | "recency";

/** Weights as whole-number percentages (editor-friendly); normalized to sum 1 at scoring time, so they need not total exactly 100. */
export type RankingWeights = Record<RankComponent, number>;

export const RANKING_COMPONENT_META: { key: RankComponent; label: string; description: string }[] = [
  { key: "icpFit", label: "ICP fit", description: "How good a fit this company is (icpFitScore)." },
  { key: "engagement", label: "Website engagement", description: "Activity on the marketing site (linked visitor engagement)." },
  { key: "followUpUrgency", label: "Follow-up urgency", description: "How overdue the next action is, plus any WhatsApp awaiting a reply." },
  { key: "buyingIntent", label: "Buying intent", description: "Opportunity score, fed by WhatsApp buying signals." },
  { key: "strategicRelevance", label: "Strategic relevance", description: "Matches an active directive or campaign's stated focus." },
  { key: "contactability", label: "Contactability", description: "Whether there's a phone, verified WhatsApp, and/or email on file." },
  { key: "recency", label: "Recency", description: "Momentum — how recently this prospect was last contacted." },
];

/** §5.7's suggested starting weights (percentages summing to 100). Tunable on /admin/settings/ranking; expect to re-tune after real use. */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  icpFit: 25,
  engagement: 20,
  followUpUrgency: 15,
  buyingIntent: 15,
  strategicRelevance: 10,
  contactability: 10,
  recency: 5,
};

export interface RankComponentScore {
  component: RankComponent;
  label: string;
  /** The raw 0–1 signal for this component before weighting. */
  signal: number;
  /** The normalized weight (0–1) actually applied. */
  weight: number;
  /** signal × weight × 100 — this component's share of the final score. */
  contribution: number;
}

export interface ProspectRank {
  /** 0–100 weighted score. */
  score: number;
  breakdown: RankComponentScore[];
  /** Short human phrases for the top contributing components — the card's "why now" line. */
  reasons: string[];
  /** True when an AI re-rank pass moved this prospect from its deterministic position. */
  aiAdjusted: boolean;
}

export interface RankedProspect extends Prospect {
  rank: ProspectRank;
}
