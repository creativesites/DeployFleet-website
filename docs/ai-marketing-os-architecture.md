# DeployFleet AI Marketing OS — Architecture & Phased Implementation Plan

**Status: planning document, not yet implemented.** Written before any code changes so the full shape of the system is agreed first — per the explicit instruction that started this doc. Nothing in this document should be treated as built until a later session's commits say otherwise.

**Audience:** whoever (human or AI) picks up implementation next. Every section is written to be directly actionable — concrete Firestore collections, concrete file paths, concrete phase boundaries — not just the vision language it's synthesized from.

---

## 0. Where this comes from

Winston (the user) supplied a 25-section vision brief for turning DeployFleet's newly-built internal CRM (`docs/` — this repo, `/admin/today` and `/admin/prospects`, built in the immediately preceding session) into what the brief itself calls an **AI-native Marketing OS**:

> Don't build "a CRM with AI features." Build an AI-native Marketing OS where the CRM is the memory and state layer, and the AI continuously interprets reality, plans, delegates, verifies, and pushes execution.

This document is that brief, reconciled against what actually exists in this codebase today, translated from a generic relational/vector-store architecture into concrete Firestore + Next.js + Vercel primitives, and organized into a phased plan — per Winston's own explicit sequencing:

> The first major engineering phase should be AI Inbox + Prospect Intelligence Pages + AI Workforce/Conversation Memory + Task/Decision extraction + Reality/Reconciliation engine + context compiler/cache. Once those are solid, the autonomous orchestration and anti-procrastination layer can sit on top of them naturally.

This is a personal-use system (Winston's own daily driver, not a multi-tenant product), which changes some tradeoffs from the rest of this site: heavier automation, more proactive AI behavior, and less caution about auto-applying changes are all acceptable here in a way they wouldn't be for DeployFleet's own customer-facing product.

---

## 1. Governing vision & north star

> Every new piece of information should either improve the system's understanding of reality, change what needs to be done, or provide evidence for a future decision. Every meaningful action should flow back into the system.

The operating loop the whole system exists to run:

```
Observe → Understand → Reconcile → Decide → Delegate → Execute → Measure → Learn → Repeat
```

The end state, in Winston's own words:

> I wake up and the system already understands the state of DeployFleet, has prepared my priorities, has coordinated the AI workforce, knows what is falling behind, and is actively pushing me toward the highest-value human actions.

Concretely, the system should shift Winston's time from *maintaining the CRM* to *executing the actions that create revenue* — the CRM updates itself from what Winston pastes in, not the other way around.

---

## 2. Current state — what actually exists today

Grounding before design, same discipline this project has followed throughout. As of the end of the previous session:

**Data (Firestore, via `src/lib/crm.ts` / `src/lib/crmTypes.ts`):**
- `prospects` — 13-stage pipeline (0 Unqualified → 12 Nurture), contact facts, `nextActionDate`/`nextActionType`/`nextActionNote`, a provenance-tagged `intelligence` map (`ProspectIntelligence`: `fleetTier`, `priorityScore`, `likelyPain`, `recommendedWedge`, `recommendedChannel`, `discoveryQuestion`, `summary` — each an `IntelligenceField<T>` with `{value, source, sourceType, confidence, verified, generatedAt}`), a `phoneClassification`, and — the one already-built cross-system link — `linkedVisitorId`/`visitorSnapshot` from DeployFleet's separate Visitor Intelligence 2.0 pipeline (website analytics, `src/lib/visitorIntelligence.ts`, a different subsystem entirely).
- `interactions` — one row per logged call/WhatsApp/note, `{type, outcome, rawNote, aiExtracted, createdAt, createdBy}`.
- `leads`, `visitors`, `visitorSessions`, `visitorEvents` — the Visitor Intelligence 2.0 collections (website traffic, not this system's concern directly, except as an input via `visitorSnapshot`).

**AI (`src/lib/ai/`):**
- `router.ts` — `completeWithFallback({systemPrompt, userPrompt})`, tries DeepSeek then Gemini, returns `{ok, text, provider, usage}` or `{ok: false, reason}`. **Plain single-turn text completion only — no function/tool-calling support exists anywhere in this codebase yet.** This is the single most important gap this plan has to account for (§5.4, §8.1).
- `cache.ts` — an in-memory `Map`, per-serverless-instance only, 6-hour TTL, successful responses only. **Not durable across cold starts or across instances** — a real constraint on Vercel, not a detail to gloss over.
- `jsonExtract.ts` — strips a stray markdown fence and `JSON.parse()`s, returns `null` on failure. Already the mechanism the two existing structured-output AI calls use.
- Two structured-JSON prompts already proven in production shape: `SDR_BRIEF_SYSTEM_PROMPT` (`/api/admin/crm/prospects/[id]/brief`) and `NOTE_EXTRACTION_SYSTEM_PROMPT` (`/api/admin/crm/prospects/[id]/parse-note`) — both single-shot "here are facts, return this exact JSON shape" calls. **This is the pattern the AI Inbox's extraction pipeline (§7.1) extends, not a new technique.**

**UI (`src/app/admin/*`, `src/components/admin/*`):**
- Sidebar shell (`AdminShell.tsx`), not tabs, grouped CRM / Analytics / Marketing / Intelligence / Settings.
- `/admin/today` — Winston's queue, per-prospect cards with brief/outcome/note/AI-parse/confirm.
- `/admin/prospects` — flat filterable list, expand-to-see-everything, no dedicated per-prospect route yet (§7.2 changes this).

**Infrastructure already available but unused for AI/CRM purposes:**
- Upstash Redis (`KV_REST_API_URL`/`KV_REST_API_TOKEN`, currently only used by `adminStore.ts` for the diesel-price editor's durable storage). This is the natural home for the durable, cross-instance context cache §5 needs — no new integration to provision, just a new use of one already connected.
- Clerk auth + `ADMIN_ALLOWED_EMAILS` — the existing two-gate admin access model. Since this is single-user (Winston), no new permissions model is needed for the AI OS itself.

**What does not exist and would be new engineering, called out honestly wherever it's needed below:** tool/function-calling in the AI router, any vector store or embedding pipeline, any background job scheduler (Vercel Cron is available but unused), any notification-delivery channel (email/Slack/push), a `tasks`/`decisions`/`conversations`/`campaigns` collection, and a dedicated per-prospect route.

---

## 3. Architecture overview

Translating the brief's layered diagram onto this stack:

```
                    ┌──────────────────────┐
                    │       Winston         │
                    └──────────┬────────────┘
                               │
                               ▼
                 ┌──────────────────────────┐
                 │   AI Command Center       │   Phase 2 — /admin (redesigned as
                 │  (system status + "what   │   a status/priority view, not just
                 │   should I do right now") │   the Overview stats page it is today)
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │    AI Orchestrator        │   Phase 2 — new: reasoning, planning,
                 │                           │   delegation, reconciliation-triggering,
                 │  (needs tool-calling —    │   coaching. The first genuinely agentic
                 │   §5.4/§8.1, new work)    │   piece in this codebase.
                 └────────────┬─────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ AI Workforce│     │ Context      │     │ Reality &    │
   │ (Team page, │     │ Compiler /   │     │ Reconciliation│  Phase 1
   │ §7.3)       │     │ Cache (§7.6) │     │ Engine (§7.5)│
   └─────────────┘     └─────────────┘     └─────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                 ┌──────────────────────────┐
                 │   DeployFleet CRM/OS      │   Firestore — §4's collections,
                 │  (Firestore collections)  │   extending crm.ts/crmTypes.ts
                 └──────────────────────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │ External world  │   Calls, WhatsApp — Winston pastes
                     │ (via Winston,   │   the outcome back in via the AI
                     │  not automated) │   Inbox (§7.1). No automated outbound
                     └────────────────┘   messaging is in scope anywhere in
                                           this plan (see §12).
```

The key deviation from the brief's own diagram: **"External World" stays human-mediated.** Nothing in this plan has DeployFleet's AI calling, texting, or emailing a prospect directly — Winston (or an AI employee working outside this system, e.g. an actual SDR persona in a separate chat tool) does the real-world action, then reports back into the AI Inbox. That's a deliberate, not accidental, scope boundary — see §12.

---

## 4. Data model

Firestore collections, extending (not replacing) `crmTypes.ts`. Every new collection follows the same conventions already established: `createdAt`/`updatedAt` as `Timestamp`, ISO strings at the type layer (`tsToIso()` pattern from `crm.ts`/`visitorIntelligence.ts`), broad-fetch-then-filter-in-memory to avoid composite indexes wherever the query shape allows it.

### 4.1 Extending `Prospect`

New fields on the existing `prospects` collection (additive — every existing field stays):

```ts
interface Prospect {
  // ...all existing fields unchanged...

  icpFitScore: number | null;        // 0-100, AI- or rule-derived fit against the ICP
  opportunityScore: number | null;   // 0-100, distinct from priorityScore — "how big" vs "how ready"
  riskFlags: string[];               // e.g. "no-decision-maker-identified", "stalled-14-days"

  campaignId: string | null;         // §6.3 — which campaign this prospect belongs to, if any
}
```

`icpFitScore`/`opportunityScore` are deliberately separate from the existing `priorityScore` (which today is either AI-brief-generated or seeded from a linked visitor's intent score) — the brief distinguishes "how good a fit" from "how much revenue" from "how ready to buy," and collapsing those into one number is exactly the kind of premature simplification this plan should avoid now that the system is meant to reason about them separately.

### 4.2 `facts` — evolving `ProspectIntelligence` into a real lifecycle

The existing `intelligence` map on `Prospect` already has provenance (`source`, `sourceType`, `confidence`, `verified`, `generatedAt`) but is a fixed-shape map (`fleetTier`, `priorityScore`, ...) with no lifecycle and no history — a new value silently overwrites the old one. The brief's Fact/lifecycle concept needs an actual append-only collection:

```ts
type FactLifecycleStatus = "new" | "active" | "confirmed" | "stale" | "reconciliation_required" | "superseded";
type FactType = "prospect_attribute" | "contact_info" | "pain_point" | "competitive" | "operational" | "other";

interface Fact {
  id: string;
  prospectId: string;
  factType: FactType;
  key: string;                 // e.g. "fleetSize", "decisionMaker", "currentTool"
  value: string;                // free text — deliberately not typed per-key; see §12 on why
  source: string;                // "AI SDR conversation, 11 Aug", "Winston direct", etc.
  sourceType: IntelligenceSourceType; // reuses the existing hierarchy from crmTypes.ts
  confidence: number | null;
  status: FactLifecycleStatus;
  supersedes: string | null;    // Fact id this replaces, if any
  supersededBy: string | null;  // set when a newer Fact replaces this one
  verifiedAt: string | null;
  lastCheckedAt: string;        // Reality Engine (§7.5) updates this on every reconciliation pass
  createdAt: string;
}
```

The existing `ProspectIntelligence` map is **not deprecated** — it stays as the compact, "current best answer" summary a UI reads without a second query (exactly what the Today-tab cards already do). `facts` is the append-only ledger underneath it; the Reality Engine and the Inbox extraction pipeline write to `facts`, and a small "current fact wins" projection keeps `ProspectIntelligence` in sync. This mirrors the same "system of record vs. compact summary" split DeployFleet's Odoo CRM work already settled on elsewhere in this project's broader history — not a new pattern, a proven one.

### 4.3 `tasks`

Generalizes beyond the single `nextActionDate`/`nextActionType` fields already on `Prospect` (which stay — they're still what `/admin/today`'s query reads) into a real, AI-creatable task entity that isn't always prospect-shaped (an AI employee's research task has no single "next action date" the way a follow-up call does):

```ts
type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
type TaskCreatedBy = "human" | "ai_orchestrator" | "ai_reconciliation" | "ai_inbox_extraction";

interface Task {
  id: string;
  title: string;
  description: string | null;
  relatedProspectId: string | null;
  relatedEmployeeId: string | null;   // §4.6 — assigned to an AI employee, not Winston
  dueDate: string | null;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  createdBy: TaskCreatedBy;
  sourceInboxEntryId: string | null;  // §4.5 — provenance back to the pasted text this came from
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 `decisions`

The Decision Ledger (§9 of the brief, "one of the most important components"):

```ts
type DecisionStatus = "active" | "superseded";
type DecisionScope = "global" | { prospectId: string } | { employeeId: string };

interface Decision {
  id: string;
  decisionText: string;         // "Prioritize trucking companies with 15+ vehicles"
  reason: string;
  scope: DecisionScope;
  evidence: string[];           // free-text citations, or Fact/Interaction ids
  status: DecisionStatus;
  supersedes: string | null;    // Decision id
  supersededBy: string | null;
  madeBy: "winston" | "ai_orchestrator";
  createdAt: string;
}
```

Never deleted, only superseded — the same "archive, don't delete" discipline `Prospect.archivedAt` already follows.

### 4.5 `inboxEntries` and `conversations`

The AI Inbox (§7.1) needs to keep the *raw* pasted text as a permanent, immutable record (the brief's "conversations become first-class data, retain provenance") separately from what gets extracted from it:

```ts
type InboxSourceType = "ai_sdr" | "ai_researcher" | "ai_sales_coach" | "ai_market_intelligence" | "ai_seo" | "ai_content" | "ai_analyst" | "winston_direct" | "call_transcript";

interface InboxEntry {
  id: string;
  rawText: string;
  sourceType: InboxSourceType;
  relatedProspectId: string | null;   // set when pasted from a prospect-specific tab (§7.2)
  relatedEmployeeId: string | null;   // set when pasted from an employee's tab (§7.3)
  pastedAt: string;
  extractionStatus: "pending" | "processed" | "failed";
  extractionResult: ExtractionResult | null;  // §7.1's shape
  reviewedByWinston: boolean;
  createdAt: string;
}
```

A `conversation` (in the brief's sense — an ongoing thread with one AI employee) is modeled as a *query* over `inboxEntries` filtered by `relatedEmployeeId`, not a separate collection — Firestore has no need for a parent "conversation" document when every entry already carries the employee id and a timestamp; a conversation is just that employee's `inboxEntries` in order. Keeps the model smaller without losing anything the brief asks for.

### 4.6 `aiEmployees`

The Team page's backing data:

```ts
type AiEmployeeStatus = "active" | "paused";

interface AiEmployee {
  id: string;
  name: string;              // "Charity", "Winston" is the human — these are the AI personas
  role: string;               // "AI SDR", "AI Researcher", "AI Sales Coach", ...
  mission: string;             // freeform, editable by Winston
  status: AiEmployeeStatus;
  instructions: string;        // standing instructions Winston has given this persona
  createdAt: string;
  updatedAt: string;
}
```

Reports and tasks *for* an employee reuse `inboxEntries` (reports Winston pastes in on the employee's behalf) and `tasks` (`relatedEmployeeId` set) rather than yet more new collections — see §12 for why a separate `aiEmployeeReports`/`aiEmployeeTasks` pair, as the brief sketches, would be redundant here specifically (this system has no channel to *actually* dispatch a task to an external AI persona and get a report back automatically — Winston is the transport layer, pasting both directions, at least in Phase 1).

### 4.7 `campaigns` (Phase 0 — see §6.3)

```ts
interface Campaign {
  id: string;
  name: string;                 // "August Outbound Offensive"
  startDate: string;
  endDate: string | null;
  targetAttempts: number | null;
  targetMeaningfulInteractions: number | null;
  status: "active" | "completed" | "archived";
  createdAt: string;
}
```

### 4.8 `auditEvents`

The system-wide activity feed (§8.5) and the audit trail the Decision Ledger's own reasoning depends on:

```ts
type AuditEventType = "fact_created" | "fact_superseded" | "task_created" | "task_completed" | "decision_made" | "decision_superseded" | "prospect_updated" | "reconciliation_flag_raised" | "ai_brief_generated" | "inbox_entry_processed";

interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  summary: string;              // human-readable, e.g. "Updated Yeshua Logistics fleet size: 25 -> 18"
  relatedProspectId: string | null;
  relatedEmployeeId: string | null;
  actor: "winston" | "ai_orchestrator" | "ai_reconciliation" | "ai_inbox_extraction";
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
```

Append-only, never edited or deleted — this collection *is* the audit trail. Every write path described in §7 must also write one of these.

---

## 5. AI context & memory architecture

This is the piece Winston flagged as a real risk ("with time the prompt and context information can get very large... we are working with max context for best results moto"), and it deserves a concrete answer, not just "use caching."

### 5.1 Layered context, not one giant prompt

Every AI call in this system should be built from up to four layers, only pulling in what a given call actually needs — never "dump the whole CRM":

1. **Global context** — DeployFleet's strategy, ICP definition, current ICP thresholds (the *current*, non-superseded `Decision`s with `scope: "global"`), ~200-400 tokens, changes rarely.
2. **Prospect/employee context** — the specific record(s) the call concerns: prospect summary, recent `facts`, open `tasks`, recent `interactions`, linked `visitorSnapshot`. Bounded by construction (a prospect's own data is never unbounded the way "the whole pipeline" is).
3. **Relevant history** — a handful of the most-recent-and-relevant `AuditEvent`s/`Decision`s for this scope, not the full history.
4. **The immediate task** — whatever Winston pasted, or the specific question being asked.

### 5.2 The cache itself — Upstash Redis, already connected

`src/lib/ai/cache.ts`'s in-memory `Map` is fine for the calculators' AI Insight panels (short-lived, low-stakes, a cache miss just means one extra provider call) but wrong for this system: Vercel serverless instances are ephemeral, so an in-memory cache is cold on every fresh instance, and this system's context blobs are exactly the kind of larger, more-expensive-to-rebuild thing worth a *durable* cache.

Reuse the Upstash Redis integration already connected for the diesel-price store (`KV_REST_API_URL`/`KV_REST_API_TOKEN`, `@upstash/redis` already a dependency) rather than provisioning anything new:

```
GLOBAL_CONTEXT                       — rebuilt when any global-scope Decision changes
PROSPECT_CONTEXT:{prospectId}        — rebuilt when that prospect's facts/tasks/interactions change
EMPLOYEE_CONTEXT:{employeeId}        — rebuilt when that employee's inboxEntries/tasks change
```

Each cache entry is a precompiled text blob (not raw JSON the caller re-formats every time) plus a `builtAt`/`sourceVersion` marker. Invalidation is **event-driven, not TTL-driven** — every write path in §4 that touches a cached scope's underlying data explicitly deletes (not just lets expire) the corresponding Redis key, forcing a rebuild on next read. A TTL as a backstop (e.g. 24h) is reasonable in case an invalidation call site gets missed, but it's a safety net, not the primary mechanism — Winston's own "max context for best results" instinct is best served by cache correctness, not by a short TTL that silently serves stale context and calls it "cached."

### 5.3 Provider-level caching — already free, worth knowing about

DeepSeek's API applies automatic, transparent prefix caching on its own backend — repeated system-prompt/context prefixes across calls get a cache-hit cost/latency discount with zero client-side code. This is a real, existing behavior of the provider already wired up in `deepseek.ts`, not something this plan needs to build — but it's a reason to keep the *system prompt* (which repeats across many calls to the same feature) stable and put the *variable* part (the specific prospect/context) in the user prompt, which this codebase's existing prompts (`SDR_BRIEF_SYSTEM_PROMPT`, `NOTE_EXTRACTION_SYSTEM_PROMPT`, `MARKETING_INSIGHT_SYSTEM_PROMPT`) already do correctly by construction. Gemini has an equivalent explicit caching API that isn't wired up yet — worth adding if Gemini becomes the primary provider for high-volume orchestrator calls, not a Phase 1 requirement.

### 5.4 Tool-calling — the one piece that's genuinely new engineering

Everything in Phase 1 (§7) can be built on the existing `completeWithFallback({systemPrompt, userPrompt}) → {ok, text}` single-shot pattern, using structured-JSON-output prompting exactly like the two AI routes already in production do. **No tool-calling is needed for extraction, brief generation, or reconciliation flagging** — those are all "here's context, give me back this exact JSON shape" calls, which is a solved problem in this codebase already.

The AI Orchestrator (§8.1) is different: "call `create_task()`," "ask AI SDR a question," "run reconciliation" are genuine multi-step, tool-invoking behaviors, not a single structured-output call. This needs:
- A `router.ts` extension (or a parallel `completeWithTools()`) supporting the OpenAI-compatible `tools`/`tool_calls` shape (DeepSeek's API is OpenAI-compatible and supports this) and Gemini's own function-calling shape separately, since the two providers' request/response formats for tool calls differ.
- A small, explicit tool registry (functions like `create_task`, `update_prospect`, `create_decision`, `flag_stale_information`) — deliberately small and hand-written, not dynamically generated from the Firestore schema, so every tool the AI can call is something a human reviewed.
- A bounded round-trip count (max 2-3 tool-call rounds per orchestrator invocation) so a misbehaving model can't loop forever — the same defensive pattern this project has used before when tool-calling was built for the sister Odoo project's Copilot Rail.

This is real, scoped Phase 2 work, not a detail to wave away — called out explicitly here so nobody discovers it as a surprise mid-implementation.

---

## 6. Phase 0 — CRM completeness (no new AI capability required)

The items deferred from the previous session, folded into this plan per Winston's explicit request. These need no orchestrator, no tool-calling, no context-cache — they're straightforward extensions of what's already built, and there's no reason to gate them behind Phase 1's AI foundation work. Safe to build in any order relative to Phase 1, including in parallel.

### 6.1 Pipeline / Kanban view

A new `/admin/pipeline` route: `PIPELINE_STAGES` (already defined in `crmTypes.ts`) as columns, `Prospect` cards grouped by `stage`. Given the mobile-first precedent already established in this project's own DeployFleet Odoo work (`deployfleet_ui`'s Dispatch Board explicitly chose tap-to-move over drag-and-drop for exactly this reason), the same choice applies here: **tap a card to open a stage-picker, not drag-and-drop** — Winston works from a phone as much as anyone this project has designed for. Reuses `listProspects()`/`updateProspect()` from `crm.ts` unchanged.

### 6.2 Weekly Targets scoreboard

A new `/admin/targets` route, against the Operating Rhythm brief's own benchmarks (10 attempts/day, 5 meaningful interactions/day, referenced throughout the original CRM planning but never built). Needs one new aggregation function in `crm.ts` — `getWeeklyScoreboard(weekStart)` — counting `interactions` by day/outcome within the week, compared against configurable per-day targets (a small `WEEKLY_TARGETS` constant, not a new collection; matches how `ENGAGEMENT_WEIGHTS` in Visitor Intelligence's `scoring.ts` is a tunable constant table, not a database-backed setting, for the same "not worth the complexity yet" reason).

### 6.3 Campaign tracking as its own entity

The `campaigns` collection (§4.7). A campaign groups a batch of prospects (via `Prospect.campaignId`) and gives the Targets scoreboard (§6.2) and the Insights page (already built, `/admin/insights`) a way to report "how did *this specific push* perform," not just "how did this week perform" — directly answers the brief's own "DeployFleet — Today's 10 should become a campaign" example. A campaign-scoped Decision (§4.4, `scope: {campaignId}` — note: extend `DecisionScope` to include this variant once campaigns exist) lets the Reality Engine (§7.5) eventually flag "this campaign's own targets haven't been hit in 3 days" as a reconciliation item.

### 6.4 Sales Coach call analysis

Not a separate feature from the AI Inbox (§7.1) — it's the Inbox's extraction pipeline applied to a `call_transcript`-sourced `InboxEntry` with a dedicated system prompt (`SALES_COACH_SYSTEM_PROMPT`, alongside the existing prompts in `ai/prompts.ts`) that asks specifically for call-quality feedback (what went well, missed opportunities, objections raised, a recommended next question) rather than generic fact/task/decision extraction. Output is a new extraction type shown alongside the others in the Inbox's review UI (§7.1), and — because it's just a specialized `InboxEntry`, not a new subsystem — it gets the audit trail, provenance, and reconciliation-eligibility every other Inbox entry gets for free. Practically, this depends on the AI Inbox existing first (Phase 1), even though it's listed here as a "deferred CRM item" — sequencing note carried into §11.

### 6.5 Manual add-prospect form

A form on `/admin/prospects` (or its own `/admin/prospects/new`) for a prospect that didn't come from the CSV seed or a promoted lead — the one prospect-creation path currently missing. Straightforward `createProspect()` addition to `crm.ts` (today only `updateProspect()` exists for prospects created via seeding/promotion) plus a client form matching the existing `DemoForm`/`CtaSection` input-field conventions already used elsewhere on this site.

---

## 7. Phase 1 — The intelligence foundation

Per Winston's own sequencing, this is the phase that has to be solid before Phase 2/3 make sense. Everything here can be built on the existing single-shot structured-output AI pattern — no tool-calling required (§5.4).

### 7.1 The AI Inbox — "paste everything"

The single highest-leverage feature in this whole plan. A new `/admin/inbox` route (plus the same paste box embedded directly on a Prospect page (§7.2) and an Employee page (§7.3), all writing to the same `inboxEntries` collection with `relatedProspectId`/`relatedEmployeeId` set accordingly).

**Flow:**
1. Winston pastes freeform text (an AI SDR's report, a call transcript, a WhatsApp export, his own note) and picks a `sourceType`.
2. A new route, `POST /api/admin/crm/inbox`, creates the `InboxEntry` (`extractionStatus: "pending"`) and immediately calls the extraction prompt.
3. **Extraction system prompt** (`INBOX_EXTRACTION_SYSTEM_PROMPT`, new addition to `ai/prompts.ts`) — given the raw text plus whatever prospect/employee context is already known (via the Context Compiler, §7.6), returns structured JSON:
   ```json
   {
     "facts": [{ "key": "fleetSize", "value": "~18 trucks", "prospectRef": "Yeshua Logistics", "confidence": 70 }],
     "tasks": [{ "title": "Call Yeshua Logistics", "dueDate": "2026-08-14", "prospectRef": "Yeshua Logistics" }],
     "decisions": [{ "decisionText": "...", "reason": "..." }],
     "risks": ["No decision-maker identified yet"],
     "recommendations": ["Ask about fuel monitoring during discovery"],
     "contradictions": [{ "field": "fleetSize", "existingValue": "25", "newValue": "18" }]
   }
   ```
   Every array is optional/empty-safe — most pasted text won't hit every category. `prospectRef` is a *name string* the model extracts, not a Firestore id (the model doesn't know ids); the route resolves it against existing `prospects` by fuzzy name match, falling back to "unmatched — ask Winston" when no confident match exists, rather than ever silently creating a duplicate prospect or attaching a fact to the wrong company.
4. **Review, not silent apply.** The route returns the extraction as a *proposal* (`extractionStatus: "processed"`, `reviewedByWinston: false`) — the UI shows "AI interpretation — 6 changes proposed" exactly as the brief describes, with per-item Approve/Reject, before anything writes to `facts`/`tasks`/`decisions`/`prospects`. This is Approval Level 0 (§8.2) applied to every Inbox extraction in Phase 1 — auto-apply for low-risk categories (§8.2's Level 1) is an explicit Phase 2 relaxation of this default, not the Phase 1 starting point.
5. On approval, each accepted item writes through the normal `crm.ts` functions (`applyIntelligence`/new `createFact`/`createTask`/`createDecision`) and an `AuditEvent` is written for each, with `sourceInboxEntryId` set — the provenance chain the brief calls for.

### 7.2 Dedicated Prospect Intelligence pages

A new dynamic route, `/admin/prospects/[id]`, replacing the current expand-in-place pattern on `/admin/prospects` for anything beyond a quick glance (the list page keeps its expand-to-preview behavior for fast scanning; "open the full page" becomes the deeper action, the same relationship the Today-tab cards should have to it — see §7.2's last paragraph).

**Structure**, following the brief's own layout:

- **Header** — name, stage, priority/ICP-fit/opportunity scores, next action, a risk-flags row (from `Prospect.riskFlags`, §4.1).
- **Overview tab** — the existing flat facts (`estimatedFleetSizeRaw`, `location`, `phoneClassification`, source, `campaignId`) — mostly what `/admin/prospects`' current expand panel already shows, moved here.
- **Intelligence tab** — the `ProspectIntelligence` summary plus the full `facts` (§4.2) history for this prospect, each fact shown with its lifecycle status, source, confidence — this is where the "fact vs. inference vs. recommendation" distinction (§10) becomes visible, not just a backend concept.
- **Employee Intelligence tab** — one paste box per active `AiEmployee` (§4.6), scoped to this prospect (`InboxEntry.relatedProspectId` set), showing that employee's past entries about this prospect and the extractions that came from them. This is the tab Winston specifically asked for: "tabs to add information from each employee specific to that prospect."
- **Interaction history tab** — the existing `interactions` list, unchanged from what `/admin/prospects`' expand panel shows today.
- **Timeline tab** — a merged, chronological view of `interactions` + `facts` + `tasks` + `decisions` + `AuditEvent`s scoped to this prospect, the single "everything that's happened here, in order" view the brief's "Timeline" section describes.

**The Today-tab connection Winston asked for:** each card on `/admin/today` gets a "View full profile" link to `/admin/prospects/[id]` — the quick-action card stays the fast path for logging today's call, the dedicated page is where the deeper, employee-specific intelligence accumulates. Both write to the same collections, so nothing is duplicated between them.

### 7.3 AI Workforce / Team page

A new `/admin/team` route, listing `aiEmployees` (§4.6) as cards — mission, status, open-task count, days-since-last-report — each linking to `/admin/team/[id]`, structured the same way as the Prospect page: Mission (editable), Objectives/`tasks` (`relatedEmployeeId` filter), the paste-box `inboxEntries` feed (this employee's own conversation history, extracted the same way as prospect-scoped entries), a Performance summary (task completion rate, a simple deterministic count — no AI-generated performance review in Phase 1), and a Winston Notes freeform field.

Seeding: five `AiEmployee` docs matching the personas already named throughout the GTM/Sales Playbook briefs this whole CRM was built against (AI SDR, AI Researcher, AI Sales Coach, AI Market Intelligence, AI SEO) — a one-time seed function in `crm.ts`, same shape as `seedProspectsFromCsv()`.

### 7.4 Decision audit trail

The `decisions` collection (§4.4) plus a `/admin/decisions` route — a flat, filterable (scope, status) list, each showing its `decisionText`/`reason`/`evidence` and, when superseded, a link to what replaced it. `POST /api/admin/crm/decisions` (create) and `POST /api/admin/crm/decisions/[id]/supersede` (creates a new decision, marks the old one superseded — decisions are never edited in place, matching the ledger's own append-only nature).

Decisions get created three ways: directly by Winston (a form), extracted from an Inbox entry (§7.1) and approved, or — Phase 2 only — by the Orchestrator itself. All three funnel through the same `createDecision()` function and get the same `AuditEvent`.

### 7.5 Reality & Reconciliation Engine

The subsystem that keeps the whole thing honest. Implemented as a callable function (not a background job in Phase 1 — see §12 on why Vercel Cron is deliberately deferred), `runReconciliation()` in a new `src/lib/crm/reconciliation.ts`, triggered manually from a button on `/admin/insights` (which already exists and already has an "Alerts" feed pattern this slots directly into — see the existing `getAlerts()` in `visitorIntelligence.ts` for the established shape this should mirror on the CRM side).

**What it checks, all deterministic (no AI call needed for detection — matches this whole project's "don't use AI for basic arithmetic" precedent from the Visitor Intelligence work):**
- **Stale next actions** — `Prospect.nextActionDate` more than N days in the past with no new `Interaction` since (a variant of what `/admin/today`'s own overdue-highlighting already partially does, generalized into a real flag).
- **Stalled facts** — any `Fact` with `status: "active"` whose `lastCheckedAt` is older than a threshold gets flagged `"reconciliation_required"`.
- **Contradictions** — two `Fact`s with the same `prospectId`+`key` and different `value`, both `status: "active"` (should be rare if the Inbox extraction's contradiction-detection, §7.1, is working, but this is the safety net that catches anything that slipped through, e.g. a fact entered before the Inbox existed).
- **Orphaned decisions** — a `Decision` still `status: "active"` whose `scope` references a prospect that's since been archived, or a campaign that's ended.
- **Missing required info** — a `Prospect` past stage 2 ("Contact Attempted") with no `contactName` set — a decision-maker was never identified after real contact attempts, exactly the brief's own example.

Each check that fires writes an `AuditEvent` (`reconciliation_flag_raised`) and surfaces on `/admin/insights`' existing Alerts feed — this is additive to that page, not a new page.

### 7.6 Context Compiler

`src/lib/ai/contextCompiler.ts` — the shared function every AI call in this system (Inbox extraction, brief generation, note parsing, and eventually the Orchestrator) calls to build its prompt context, implementing §5's layered model:

```ts
async function compileProspectContext(prospectId: string): Promise<string> // checks Redis first, rebuilds+caches on miss
async function compileEmployeeContext(employeeId: string): Promise<string>
async function compileGlobalContext(): Promise<string>
function invalidateProspectContext(prospectId: string): Promise<void>   // called from every write path touching that prospect
```

This is genuinely new code, but small and mechanical — every write function in `crm.ts` that touches a prospect/employee/global-scoped record gets one added line calling the matching `invalidate*Context()`. Building this *before* the Inbox/Prospect-page work (§7.1/§7.2) start consuming it, even though it's listed last in this section, is the right implementation order — see §11.

---

## 8. Phase 2 — Orchestration layer

Sits on top of Phase 1. Nothing here should start until §7's collections, pages, and context compiler are in real daily use — per Winston's own instruction, and because the Orchestrator's tools (§8.1) are mostly thin wrappers around the same `crm.ts` functions Phase 1 already had to build well.

### 8.1 The AI Orchestrator

The first genuinely agentic component in this codebase (§5.4's tool-calling is its prerequisite). A new `src/lib/ai/orchestrator.ts`, exposing a bounded tool registry:

```
create_task, update_task, complete_task
create_prospect, update_prospect
create_decision, supersede_decision
flag_stale_information (manually triggers a §7.5 check for one prospect)
request_ai_employee_report (creates a Task with relatedEmployeeId — since there's no live channel to an external AI persona, this surfaces on the Team page as "Winston, ask this employee for X" rather than actually messaging anyone)
generate_daily_brief, generate_pipeline_report
```

Every tool call the Orchestrator makes writes an `AuditEvent` — this is what makes the system-wide activity feed (§8.5) meaningful and what makes "why did the system do this?" (§10) answerable.

### 8.2 Approval / autonomy levels

Exactly the brief's own tiering, implemented as a per-tool-call check inside the Orchestrator (not a separate permissions system — DeployFleet's Odoo sister project already has a mature version of this exact pattern, "auto-executable action allow-list," worth mirroring in shape even though this is a different codebase):

| Level | What | Default in this plan |
|---|---|---|
| 0 — Suggest | AI proposes, Winston approves | Every Inbox extraction (§7.1) in Phase 1, and everything in Phase 2 until proven safe |
| 1 — Auto-apply, low-risk | Notes, timestamps, activity logs | Safe to flip on early in Phase 2 |
| 2 — Auto-create operational | Follow-up tasks, research tasks | Phase 2, after Level 1 is trusted |
| 3 — Workforce delegation | `request_ai_employee_report`, etc. | Phase 2 |
| 4 — Human required | Stage changes past "Qualified," ICP changes, anything destructive | Always — never auto-approved, matching this personal-use system's own stated priority (automation, but not unaccountable automation) |

### 8.3 System State object

A single, always-current summary — not a new Firestore collection, a *computed* document (cached via the same Redis pattern as §5.2, key `SYSTEM_STATE`, rebuilt on the same triggers as `GLOBAL_CONTEXT`) — giving the Orchestrator and Command Center one place to read "what's the state of everything" instead of re-querying five collections per call: current campaign, today's attempt/meaningful-interaction counts vs. target, the single biggest bottleneck (computed heuristically — e.g. "most tasks overdue by category"), top prospect by `opportunityScore`, top risk (most common `riskFlag` across active prospects).

### 8.4 AI Command Center

`/admin` itself (today's Overview page) evolves into this — not a new route, a redesign of the existing one once §8.3's System State exists to drive it: pipeline health, overdue-task count, prospects-needing-attention count, AI-workforce awaiting-report count, a top-3-actions recommendation, and a "what should I do right now?" prompt box that calls the Orchestrator directly.

### 8.5 System-wide activity feed

A `/admin/activity` route reading `AuditEvent` chronologically — the "system feels alive" feed from the brief, directly backed by §4.8's collection, which every prior phase has already been writing to.

---

## 9. Phase 3 — Anti-procrastination engine

The most personality-driven part of the brief, and correctly sequenced last — it needs the System State (§8.3) and the Orchestrator (§8.1) to already know what "on track" and "behind" mean before it can be pushy about the gap.

- **Morning brief** — Orchestrator-generated, using `generate_daily_brief()`, pushed to the top of the Command Center (§8.4) on first load of the day.
- **Midday nudge** — a computed check (time spent in non-outbound activity today vs. outbound target) surfaced the same way, not a notification (no delivery channel exists — see §12).
- **End-of-day review** — target vs. actual, with a forced classification prompt on any incomplete task (`no-answer`/`bad-data`/`blocked`/`forgot`/`low-priority`/`avoided`/`other`) — this classification data itself becomes a new `Fact`-like signal (`factType: "operational"`, scoped to Winston himself conceptually, or simply an `AuditEvent` — a modeling decision to make when this phase actually starts, not now).
- **Procrastination-pattern detection** — a genuinely later-stage feature (needs weeks of the classification data above to have anything to learn from); flagged here as the natural next step, not scoped further in this document.

---

## 10. Explainability

A cross-cutting requirement, not a separate feature: every AI-written `Fact`, `Task`, and `Decision` carries enough provenance (`source`, `sourceType`, `confidence`, and — once §8.1 exists — the `AuditEvent` trail of which Orchestrator tool call created it) to answer "why?" directly from stored data, no special "explain yourself" AI call needed. The fact/inference/recommendation distinction (§7.1's extraction shape already separates `facts` from `recommendations`) is what makes this possible — collapsing them into one undifferentiated "AI said so" bucket is exactly the failure mode this plan avoids by keeping `FactType`/`sourceType` first-class from Phase 1 onward.

---

## 11. Phased rollout plan

```
Phase 0 (any time, parallel to Phase 1)
  Pipeline/Kanban view (§6.1)
  Weekly Targets scoreboard (§6.2)
  Campaign entity (§6.3)
  Manual add-prospect form (§6.5)

Phase 1 (the foundation — build in this order, each depends on the last)
  1. Context Compiler + Redis cache wiring (§7.6, §5.2)         — build first; everything else calls it
  2. facts/tasks/decisions/auditEvents collections + crm.ts fns (§4.2-4.4, §4.8)
  3. Prospect Intelligence pages (§7.2)                          — needs #2's collections to have anything to show
  4. AI Workforce / Team page (§7.3, incl. seeding aiEmployees)
  5. AI Inbox (§7.1)                                             — needs #2 (writes facts/tasks/decisions), #3/#4 (the per-prospect/per-employee paste boxes)
  6. Sales Coach call analysis (§6.4)                            — a specialization of #5, so it lands here despite being a "Phase 0" item conceptually
  7. Decision audit trail UI (§7.4)                              — the collection exists from #2, this is just the dedicated list view
  8. Reality & Reconciliation Engine (§7.5)                      — needs everything above to have real data to reconcile

Phase 2 (orchestration — do not start until Phase 1 is in real daily use)
  1. Tool-calling support in the AI router (§5.4)
  2. AI Orchestrator + tool registry (§8.1)
  3. Approval/autonomy levels (§8.2)
  4. System State object (§8.3)
  5. AI Command Center redesign of /admin (§8.4)
  6. System-wide activity feed (§8.5)

Phase 3 (anti-procrastination — sits on top of Phase 2's System State + Orchestrator)
  Morning brief / midday nudge / end-of-day review / procrastination-pattern detection (§9)
```

---

## 12. Open questions & risks — flagged, not resolved here

Honest gaps, matching this project's own standing discipline of surfacing what a plan doesn't answer rather than silently picking an answer:

- **Resolved: outbound automation is email-only, capped, and one-directional.** Winston has confirmed the actual scope: marketing emails go out via EmailJS (client-side sending, no new backend email service), capped at 20/day. **No call automation anywhere, ever** — calls and WhatsApp stay entirely human-mediated, as originally planned. Inbound stays human-mediated too: Winston copies responses from his email inbox back into the AI Inbox (§7.1) himself — there's no automated inbox-reading in scope. This means "External World stays human-mediated" (§3) is now accurate for every channel *except* the outbound half of email, which needs its own new subsystem: an `emailSends` collection (recipient, template, campaignId, sentAt, status), a per-day send counter enforcing the 20/day cap, and a `POST /api/admin/crm/email/send` route wrapping EmailJS's client SDK (EmailJS is designed for client-side sending with a public key, so the 20/day cap has to be enforced server-side in this new route regardless — never trust a client-side-only limit). Not scoped into Phase 0/1 above; natural home is alongside the Campaign/Outreach entity (§6.3) once that exists, since email sends are naturally campaign-scoped. Revisit sequencing once Phase 0 is done.
- **No background job scheduler is used anywhere in Phase 1/2** — every AI process (extraction, reconciliation, brief generation) is triggered by a page load or a button click, not a cron job. Vercel Cron is available and unused; the daily cycle (§21 of the original brief, folded into §9 above) would need it once "runs automatically every morning" becomes a real requirement rather than "Winston opens the Command Center and it's ready." Worth revisiting explicitly in Phase 3.
- **`Fact.value` is a free-text string, not typed per-key** — deliberately, since a generic `facts` ledger covering arbitrary extracted attributes can't have a fixed TypeScript shape the way `ProspectIntelligence`'s named fields do. This trades type safety for flexibility; worth watching whether it becomes a real usability problem once there's enough data to want to query/filter facts by value, not just by key.
- **No vector store or embedding pipeline is proposed anywhere in this plan** — the brief's "long-term memory" layer (§10 of the original brief) is handled here via Firestore queries + the Redis context cache, not semantic search. This is a real simplification versus the brief's own architecture diagram; it should hold fine at this system's actual scale (dozens to low hundreds of prospects, one human user) but is worth flagging as a deliberate scope cut, not an oversight.
- **Multi-provider tool-calling (§5.4) is unverified** — like every other AI integration in this project, it's implementable to the documented API shapes but not verified against a live call from this dev environment. Same standing caveat as everywhere else AI work has happened in this codebase.
- **`aiEmployees` are a fiction Winston mediates, not autonomous agents with their own runtime.** Worth being explicit about this now: "AI SDR" in this system is a *persona Winston pastes conversations on behalf of* (from wherever the real conversation happened — a separate chat tool, a real phone call, etc.), not a live, independently-running agent this codebase invokes. That may be exactly right for Phase 1-3 as scoped, but if the long-term goal is a truly autonomous AI SDR making its own calls, that's a different, much larger project than anything in this document.
