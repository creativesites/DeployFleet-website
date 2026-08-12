# DeployFleet Revenue Operating System — the Daily Command Center Architecture

**Status: planning document, not yet implemented.** Written before any code changes, per the same discipline every prior phase in this project has followed (`docs/ai-marketing-os-architecture.md`, `docs/whatsapp-intelligence-architecture.md`) — the full shape of the system agreed first, grounded in what actually exists today, not assumed. Nothing in this document should be treated as built until a later session's commits say otherwise.

**Audience:** whoever (human or AI) picks up implementation next. Every section traces to a specific existing file or a specific new one — not the vision language it's synthesized from.

---

## 0. Where this comes from

Winston supplied a 27-section vision brief with one governing reframe:

> `/admin/today` should not merely tell Winston which prospect to contact. It should run Winston's entire workday.

And a second, load-bearing constraint:

> AI should be the intelligence layer, not the infrastructure layer. If Claude/OpenAI/etc. is unavailable, the CRM must still function perfectly using deterministic rules.

This document reconciles that brief against **an actual read of the current codebase** — not the brief's own architecture sketches taken on faith — the same "ground it, then plan it" discipline `ai-marketing-os-architecture.md` and `whatsapp-intelligence-architecture.md` both used. Section 2 is the load-bearing part: a surprising amount of what the brief asks for already exists, in a different shape or a different place than the brief assumes, and the honest thing to do is say so rather than silently re-propose it.

---

## 1. Governing vision & north star

Winston's own loop, unchanged, because it's exactly right and it's a real generalization of the loop `ai-marketing-os-architecture.md` already implements for the narrower "prospect outreach" case:

```
DIRECT → ORIENT → PLAN → EXECUTE → CAPTURE → LEARN → ADAPT → REPEAT
```

| Stage | Meaning | What it maps onto |
|---|---|---|
| **Direct** | CEO/company directives, weekly objectives | New — §4.1 |
| **Orient** | Daily AI-team briefings, accumulated intelligence | AI Inbox + AiEmployee, generalized — §4.2 |
| **Plan** | Today's priorities, the daily prospect selection | Today's `dueBy` filter, replaced with a real ranking engine — §5.7 |
| **Execute** | Calls, WhatsApp, email, follow-ups | Already built (Today's contact actions, SendEmailPanel, SendWhatsAppPanel) |
| **Capture** | Interactions, notes, conversations | Already built (Interaction, the AI Inbox, WhatsApp conversation intelligence) |
| **Learn** | AI extracts signals, objections, ICP patterns | Partially built (Fact ledger, WhatsApp buying signals) — needs a pattern-detection layer, §5.20 |
| **Adapt** | Update prospect intelligence, scoring, strategy | Partially built (`applyIntelligence`, `opportunityScore` writes) — needs the Decision Ledger used at this scale |
| **Motivate** | Keep Winston moving | Partially built (Daily Rhythm's three nudges) — needs the Victory Log/streaks layer, §5.22–23 |

**The AI-availability principle is not new to this document — it's already this project's own standing practice, just never written down as a rule.** Every AI feature built so far (`completeWithFallback`, the `AI_FEATURES_ENABLED` kill switch, every route's `if (!result.ok) return {reason}` branch) already degrades to "AI insight unavailable" rather than breaking. §6 formalizes this as a binding rule for every new subsystem this document proposes, closing the gap between "happens to be true so far" and "is guaranteed."

---

## 2. Current state — what actually exists today

Grounding before design. Every claim below traces to a file read during this session, not assumed from an earlier summary.

### 2.1 `/admin/today` as built (`TodayTab.tsx`)

A real interaction queue, not a mockup: `GET /api/admin/crm/prospects?dueBy=<today>` → every non-archived prospect whose `nextActionDate` is on or before today, oldest first. Each `ProspectCard` has: an AI "Prepare Me" brief button (`POST .../brief`, `SDR_BRIEF_SYSTEM_PROMPT`), contact actions (`tel:`, a bare `wa.me` deep link — **not yet wired to the WhatsApp gateway just built**, Email), an outcome-chip picker, a note box with an optional AI "Suggest next step" parse (`POST .../parse-note`), and one real write on **Confirm & Log**: `POST .../interactions` + `PATCH .../prospects/[id]`. Everything upstream of that click is a proposal; nothing auto-applies. This is genuinely the seed of "Execute" and "Capture" — the brief's own vision doesn't need to replace this, it needs to wrap it in a command center and feed it a much better prospect list.

**What Today does *not* do today, confirmed by reading it, not assumed:** no CEO directive, no weekly/daily goal visibility beyond "attempts today" (which lives on a *different* page, see §2.2), no AI-team briefing surface, no deterministic-vs-AI ranked prospect selection (today's list is a plain date filter, sorted by date — `priorityScore`/`icpFitScore`/`opportunityScore` all exist as fields but nothing combines them into a ranking), no call-mode/guided-script UI, no message-tone composer, no visitor-intent-driven re-prioritization.

### 2.2 The Command Center is on `/admin` (Overview), not `/admin/today` — a real split worth naming explicitly

`CommandCenter.tsx` renders on the Overview page, above the old Visitor Intelligence stats, **not** on Today. It already has real pieces of what the brief is asking for:

- **System State** (`src/lib/ai/systemState.ts`, `GET /api/admin/crm/system-state`, 15-min Redis-cached): current campaign, today's attempts/meaningful vs. target, overdue count, `biggestBottleneck` (a real `if` chain, not AI — attempts pace → overdue → WhatsApp awaiting response → a high-opportunity verified-WhatsApp prospect with zero outreach), top prospect by `opportunityScore`, top risk flag, WhatsApp-awaiting-response count.
- **Daily Rhythm** (`DailyRhythm.tsx` + `useDailyRhythm.ts`): a real Morning Brief (calls the Orchestrator's `generate_daily_brief` tool), a Midday Nudge (pure `if` on pace, no AI), and an End-of-Day Review (forces `TaskIncompleteReason` classification on every task still open past its due date) — each shown once per calendar day via a `localStorage`-backed hook. **This is already most of the shape of the brief's own §23 "End-of-day AI debrief"**, just without the "what should tomorrow's focus be" synthesis step yet.
- **The Orchestrator chat box** ("What should I do right now?") — real tool-calling against DeepSeek/Gemini, `TOOL_REGISTRY` with 11+ tools (create/update task, create/update prospect, create/supersede decision, request an AI-employee report, plus the three WhatsApp tools just added), every write-capable tool defaulting to a proposal card Winston has to click Approve on. High-stakes stage changes and WhatsApp sends are never one-click-approvable from here — they link out to the real surface instead.
- Four KPI tiles (attempts today, prospects due, overdue, stale AI-employee count) plus the WhatsApp-awaiting-response tile just added.

**This is the single biggest open architectural question this document has to resolve, not silently pick a side on**: does the new Daily Command Center *replace* `/admin` Overview's Command Center, *absorb* it into `/admin/today`, or stay split? §3 below makes the call, with reasoning.

### 2.3 AI Team / AI Inbox — already most of "Daily AI Team Briefing" and "Intelligence Ingestion," just not shaped as daily-required submissions

- **`AiEmployee`** (`crmTypes.ts`): 5 seeded personas (Charity/AI SDR, Mwansa/AI Researcher, Bupe/AI Sales Coach, Chanda/AI Market Intelligence, Natasha/AI SEO) — `name`/`role`/`mission`/`status`/`instructions`. **This is already the brief's own "configurable worker roles," not hard-coded** — Winston can rename/redirect any of them from `/admin/team`. What's missing: `daily_required_input`/`weekly_required_input`/`submission_status`/`priority` fields the brief's §3 asks for — `AiEmployee` has no submission-cadence concept at all today.
- **`InboxEntry`** (`crmTypes.ts`, `POST /api/admin/crm/inbox`): the exact "paste raw text → extract structured facts/tasks/decisions/risks/recommendations/contradictions → review → apply" pipeline the brief's §5 and §13 both ask for, already built, already reused for the just-shipped WhatsApp conversation intelligence (`src/lib/ai/inboxExtraction.ts`). **This is the real, working "Intelligence Ingestion Layer"** — it's missing the brief's own richer extraction taxonomy (competitors, timeline, budget, decision-makers, unanswered questions as named fields rather than folded into free-text facts) and it has no per-worker daily-cadence tracking (`InboxEntry.pastedAt` exists, but nothing asks "has Charity submitted anything today?").
- **The Sales Coach specialization** (`SALES_COACH_SYSTEM_PROMPT`, `CallAnalysis`) already produces "what went well / missed opportunities / objections raised / recommended next question" — exactly the brief's §3 Sales Coach bullet list, scoped to one call transcript at a time rather than a rolling daily coaching feed.

**What's genuinely missing**: no "submission completeness" concept (the brief's §4 progress bars, "VP Marketing Daily Directive Missing"), no daily-synthesis pass that reduces today's inbox entries into "today's intelligence changed: 3 prospect priorities, 1 messaging recommendation..." — every `InboxEntry` today is read one at a time, never rolled up.

### 2.4 Weekly Targets — real, but hardcoded, not configurable (the brief's §8 gap, confirmed exactly)

`TARGET_ATTEMPTS_PER_DAY = 10` / `TARGET_MEANINGFUL_PER_DAY = 5` are literal constants in `crm.ts`, read by `getWeeklyScoreboard()` and surfaced on `/admin/targets` (`TargetsTab.tsx`, a 7-day grid with per-day met/not-met coloring) — genuinely useful, genuinely not editable anywhere in the UI, and genuinely flat (same target every day of the week, no per-weekday variation, no calls/WhatsApp/emails/demos sub-targets — just "attempts" and "meaningful interactions" as two undifferentiated buckets).

**The exact right precedent to copy already exists in this codebase**: `src/app/api/diesel-price/route.ts` + `DieselPricesTab.tsx` — an admin-editable value, persisted via `getStore()` (Upstash Redis when configured, in-memory fallback otherwise, the app's own established "degrade gracefully without new infra" pattern), with a clear "not persistent yet" banner when Redis isn't configured. §4.3 below reuses this shape exactly for daily/weekly goals, rather than inventing a new persistence pattern.

### 2.5 `/admin/insights` — already the seed of "Marketing Intelligence" pattern detection, scoped to visitor analytics and CRM hygiene, not yet to conversation-derived patterns

`InsightsTab.tsx` has three real things already: (1) deterministic **Alerts** (computed fresh per visit, no AI), (2) the **Reality & Reconciliation Engine** (`POST /api/admin/crm/reconciliation/run`) — a real, deterministic pattern-checker (stale next actions, stalled facts, contradicting facts, orphaned decisions, prospects past first contact with no decision-maker) that's the exact shape of a "no AI, still finds real problems" engine, and (3) an **AI Marketing Insight** narrative generated over already-aggregated, already-anonymous visitor stats. This is real, working precedent for §20's "Marketing Intelligence" page — it needs a fourth input (patterns across *conversation content*, not just visitor stats and CRM hygiene — "5 prospects mentioned manual dispatching this week") that doesn't exist yet, since nothing currently aggregates `Fact`/`InboxEntry`/WhatsApp-analysis content across the whole prospect base looking for repeated language.

### 2.6 The Prospect page (`ProspectDetail.tsx`) — five tabs, real data, not yet a "workstation"

Overview (contact fields, phone classification, `visitorSnapshot` — see §2.7, `SendEmailPanel`, `SendWhatsAppPanel`, `ProspectContacts`), Intelligence (current-best-answer card + the full `Fact` history), Employee Intelligence (paste-box per AI employee, scoped to this prospect), Interaction history, Timeline (a merged read across interactions/facts/tasks/decisions/audit events). Real, useful, genuinely closer to a database-record view than the brief's §10 "sales cockpit" vision — no persistent header strip with one-tap actions across every tab, no side-by-side SDR/Sales-Coach intelligence panel, no call workspace, no message composer with tone variants.

### 2.7 Visitor Intelligence — a real, fully deterministic, three-collection system; richer than the brief assumes in some ways, missing in others

`visitorTypes.ts`/`visitorIntelligence.ts` already implement most of the brief's own §14–16 data-model sketch, just under different names and with one entity collapsed:

- **`Visitor` / `VisitorSession` / `VisitorEvent`** — the brief's "Anonymous → Fingerprint → Session → Known contact" identity layers already exist: `identifyVisitor()` is fingerprint-first with a legacy-localStorage-id fallback, sessions have a real lifecycle (`getOrStartSession`/`startNewSession`/`recordHeartbeat`/`endSession`, 30-minute inactivity window, returning-visitor score bonuses). **The brief's separate "PageView" entity doesn't exist as its own collection — a page view is just one of 29 `EventType` values on `VisitorEvent`**, alongside `pricing_view`/`whatsapp_click`/`demo_request`/`calculator_start`/`calculator_complete`/`phone_click`/`download`/video events/`faq_open` and more. This is a real, deliberate difference from the brief's own sketch, not a gap — a unified event stream is arguably the better shape, since it's what the brief's own richer event list (pricing views, calculator completions, WhatsApp clicks) needs anyway. The full 29-type vocabulary is genuinely wired end-to-end (client SDK → the events API route's allowlist → `recordEvent()`), though whether every one of the 29 types has a live call site in the marketing site's own pages was not exhaustively re-verified.
- **Scoring is 100% deterministic, no AI or ML anywhere in the pipeline** — `ENGAGEMENT_WEIGHTS`/`INTENT_WEIGHTS` weight tables in `src/lib/analytics/scoring.ts`, `recordEvent()` increments both the session's and the visitor's engagement/intent scores atomically via `FieldValue.increment` in the same write. **A real limitation worth carrying forward**: scores are incrementally accumulated, not stored as raw event history replayed on read — so if the weight tables are ever tuned, no code path exists to retroactively recalculate historical visitors' scores under the new weights. This matters directly for §5.7's own configurable ranking weights below: the same "can't retroactively recalculate" caveat applies there too, and should be designed in from the start rather than discovered later.
- **Geography is country/city only — no map, no coordinates, no geocoding anywhere in this codebase.** `getGeographyBreakdown()` groups by `Visitor.country`/`.city` (two-level, from `lastSeenAt`-filtered docs) with no lat/lng on any entity — `VisitorEvent` doesn't even carry location, only `Visitor`/`VisitorSession` do. `GeographyTab.tsx` renders a plain HTML table with UI copy explicitly stating no map exists yet and one would need a Google Maps API key. Confirmed via repo-wide grep: **zero Google Maps/Mapbox/Leaflet/geocoding integration exists anywhere in this codebase today.** The brief's §19 Google-Maps ask is genuinely new work, not a reshaping of something that already exists — see §5.14–19 below.
- **`Visitor.companyId` is a dead field** — present in the type, never set by any code path anywhere. **No `Company`/`Account` entity exists anywhere in this codebase.** The brief's §18 "account-level visitor intelligence" (multiple people from the same trucking company visiting, aggregated) has zero backing today, not a partially-built version of it.
- **The Prospect↔Visitor link is a one-time snapshot, not live.** `Prospect.visitorSnapshot` (§2.6) is written exactly once, by `syncLeadsToProspects()`, at the moment a lead is promoted to a prospect, via a single Firestore query for that lead's linked visitor. `linkedVisitorId` is stored on the Prospect at that same moment but — confirmed by a repo-wide grep, not assumed — **is never read again anywhere in the codebase.** There is no cron, no on-visit hook, no read-time join that keeps a Prospect's visitor data current after promotion. This is the one fact from this section with the most direct consequence for §5.7's ranking engine: "Yeshua Logistics visited pricing twice today" cannot reprioritize today's queue without new code, regardless of how much of the underlying event/scoring model already exists.
- **No dedicated visitor-profile route exists.** The brief's various sketches of a visitor detail view are already real, just not a separate page — `VisitorsTab.tsx` renders the full profile (Identity/Engagement/Acquisition/Geography/Technology/Behavior sections plus an event timeline) as an inline expandable panel within the same tab, not `/admin/visitors/[id]`. It also does not show any downstream Prospect/pipeline data today — a visitor who became a prospect isn't cross-linked back from this view either.
- Other real, working analytics functions worth knowing about before proposing new ones: `getContentPerformance()`, `getCampaignPerformance()`, `getFunnelSummary()`, `getActiveVisitors()` (polling-only, no push), `getAlerts()` (computed fresh on read, not a background job), `backfillVisitorsFromPageviews()` (an idempotent legacy-data migration), and a deterministic `classifyReferrer()` (organic/paid/direct/social/referral) — the only "intent signal" this codebase derives from traffic source today, relevant to §5.21 below.

### 2.8 WhatsApp Intelligence (just shipped, this session) — a second, richer real-time signal source the brief doesn't yet know about

Every piece of Winston's own §17/§18 vision ("a visitor becomes a known prospect, buying signals reprioritize the queue") already has a *working, shipped* analog in the WhatsApp system built immediately before this document: inbound message analysis writes `buyingSignals` directly onto `Prospect.opportunityScore` with no approval gate (§10 of the WhatsApp doc — the same "score from an always-on field, never an opt-in agent" lesson Winston's own Zuri product's history validated), `WhatsAppConversation.requiresResponse`/`responseUrgency` already exist and already feed `SystemState.whatsappAwaitingResponseCount` and the `biggestBottleneck` check. **This document should treat WhatsApp signals as a first-class input into the new Daily Prospect Selection Engine (§5.7), not bolt them on separately from the "visitor intent" signal the brief describes** — they're the same shape of thing (an external system detecting intent, in real time, that should reprioritize today's queue).

### 2.9 The Decision Ledger exists and is exactly the right shape for "CEO Directives," almost unused so far

`Decision` (`crmTypes.ts`): `decisionText`/`reason`/`scope` (`global` | `prospect` | `employee`)/`evidence`/`status`/`madeBy`, append-only, superseded-not-edited, with its own audit-trail UI at `/admin/decisions`. A `scope: {type: "global"}` Decision **already is** a CEO directive in every structural sense — it's just never been used that way, and there's no "primary objective" concept (a single, currently-active directive pinned at the top of the day) versus the general list of standing decisions `/admin/decisions` shows today.

---

## 3. The governing architectural decision: `/admin/today` becomes the Daily Command Center; `/admin` (Overview) narrows to visitor analytics

Per the brief's own §26 ("don't make `/today` enormous... deep functionality lives elsewhere") and its own §2 (Command Strip + Weekly + Today targets *at the very top of Today itself*), the two intentions only resolve one way: **the Command Center content currently on `/admin` (System State, Daily Rhythm, the Orchestrator ask-box, the KPI tiles) moves to `/admin/today`, becomes the top of the page, and the prospect queue becomes the bottom half.** `/admin` (Overview) keeps exactly what it had *before* the Command Center was added to it — visitor/lead pipeline stats — since that's genuinely a different job (marketing performance overview) from "what do I do right now," and the brief's own `/admin/intelligence` (§20) is the more natural home for cross-cutting pattern detection than a second copy of the Command Center.

This is a real, disclosed reversal of a small piece of `ai-marketing-os-architecture.md` §8.4 ("sits above the existing Visitor Intelligence Overview stats on /admin, not a new route") — that was the right call when Today was still a simple queue with nothing else to lead with; it's the wrong call once Today is meant to open every workday. Flagged here rather than silently diverging, per this project's own standing rule for exactly this situation.

---

## 4. Data model additions

New Firestore collections/fields, following the exact conventions every prior phase has used: `createdAt`/`updatedAt` as `Timestamp`, ISO strings at the type layer, broad-fetch-then-filter-in-memory, flat collections.

### 4.1 `Directive` — CEO/company objectives (§2's "Direct")

```ts
type DirectiveStatus = "active" | "archived";

interface Directive {
  id: string;
  title: string;                 // "Primary company objective"
  body: string;                  // free text — strategic priorities, constraints, explicit asks
  weekOf: string | null;         // ISO Monday date, if this is a weekly objective; null for standing/primary
  status: DirectiveStatus;
  createdBy: "winston";          // a human writes these; never AI-authored
  createdAt: string;
  updatedAt: string;
}
```

Deliberately **not** built on top of the Decision Ledger's `scope: "global"` shape, even though it's structurally similar — a Directive is authored top-down by Winston-as-CEO and is meant to be singular/pinned ("the one thing at the top today"), where a global Decision is an accumulating list of standing strategic calls (some AI-proposed, most retrospective). Conflating them would make the Command Strip's "what's our objective right now" question ambiguous between "the newest decision" and "the one Winston actually pinned." A `Directive` can *reference* a Decision's id in its body text; no schema coupling.

### 4.2 `WorkerBriefing` — generalizes `AiEmployee` + `InboxEntry` into the brief's §3/§4 cadence model

```ts
type BriefingCadence = "daily" | "weekly";
type BriefingStatus = "pending" | "submitted" | "stale"; // stale = submitted, but past its own cadence window unrenewed

interface AiEmployee {
  // ...existing fields unchanged...
  dailyRequiredInput: string | null;   // what this worker is expected to submit each day, plain text prompt for the human/AI submitting it
  weeklyRequiredInput: string | null;
  expectedByHour: number | null;       // e.g. 9 for "expected by 09:00" — null = no deadline tracked
}

interface WorkerBriefing {
  id: string;
  employeeId: string;
  cadence: BriefingCadence;
  periodKey: string;              // "2026-08-13" for daily, "2026-08-10" (Monday) for weekly
  sourceInboxEntryId: string;     // every briefing IS an InboxEntry — this just adds cadence bookkeeping on top, not a second content store
  status: BriefingStatus;
  createdAt: string;
}
```

**Deliberately a thin bookkeeping layer over the existing `InboxEntry`, not a new content store.** A worker "submitting their daily briefing" is still Winston pasting text into the existing AI Inbox, scoped to that employee, exactly as today — `WorkerBriefing` just tags *which* `InboxEntry` counts as today's/this week's required submission for completeness tracking (§5.4), so the extraction/review/apply pipeline itself needs zero changes.

### 4.3 `DailyGoals` / `WeeklyGoals` — configurable, reusing the diesel-price precedent exactly (§2.4)

```ts
interface DailyGoalSet {
  prospects: number;
  meaningfulConversations: number;
  calls: number;
  whatsapp: number;
  emails: number;
  followUps: number;
  demos: number;
  researchActions: number;
}

// Keyed 0 (Sunday) - 6 (Saturday); a day with no override falls back to `default`.
interface GoalsConfig {
  default: DailyGoalSet;
  overrides: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Partial<DailyGoalSet>>>;
  updatedAt: string;
}
```

Stored via `getStore()` (same Redis-when-configured/in-memory-fallback as diesel prices) under a single `GOALS_CONFIG` key — not a Firestore collection, since this is a small, singleton, frequently-read config object, exactly diesel-price's own shape. `/admin/settings/daily-goals` is a new admin page mirroring `DieselPricesTab.tsx`'s own edit-and-save pattern. `getWeeklyScoreboard()`/`getSystemState()` read from this instead of the two hardcoded constants; the constants become the shipped `default` values, not deleted (same number Winston already validated by using them).

### 4.4 Deterministic prospect-ranking output — computed, not stored as its own entity

The brief's §7 weighted-scoring engine is a pure function over existing fields (`icpFitScore`, `opportunityScore`, `Prospect.visitorSnapshot`/live visitor link — see §5.16, `nextActionDate` recency, WhatsApp `requiresResponse`/`responseUrgency`, contactability flags) — **no new persisted entity**. It's computed fresh on every `/admin/today` load (cheap: one bounded prospect fetch, already happening), same as `SystemState`'s own `biggestBottleneck` `if`-chain. Weights live in `GoalsConfig`-adjacent config (§5.7 below), not hardcoded.

### 4.5 `VictoryLogEntry` (§5.22–23)

```ts
type VictoryType = "first_contact" | "meaningful_conversation" | "pain_disclosed" | "demo_booked" | "icp_insight" | "goal_hit";

interface VictoryLogEntry {
  id: string;
  type: VictoryType;
  summary: string;                 // "First contact established with Yeshua Logistics"
  relatedProspectId: string | null;
  createdAt: string;
}
```

Written deterministically at the exact moment the underlying fact becomes true (an `Interaction` with outcome `right-person`/`meaningful-conversation`/`demo-booked` gets logged; a stage change to a threshold; a daily-goal hit detected by the same code that already computes `todayAttempts`/`todayMeaningful`) — never an AI judgment call about what counts as a win, matching §6's rule.

### 4.6 `CallSession` (§5.11's "Call Mode")

```ts
type CallScriptStepStatus = "pending" | "complete" | "skipped";

interface CallScriptStep {
  id: string;               // "opening" | "permission" | "discovery" | ...
  label: string;
  script: string | null;    // suggested line, if any
  goal: string | null;
  questions: string[];
  status: CallScriptStepStatus;
}

interface CallSession {
  id: string;
  prospectId: string;
  startedAt: string;
  endedAt: string | null;
  steps: CallScriptStep[];
  createdBy: "winston";
}
```

A `CallSession`'s step list is generated once at start (deterministic default script + prospect-specific substitutions — see §5.11) and then just tracks Winston's own tap-through progress; it is not itself an `Interaction` — completing or abandoning a call session still ends in the existing "What happened? → Confirm & Log" flow, so nothing about the existing Interaction/Task/audit-trail machinery changes.

### 4.7 `IntelligencePattern` (§5.20 Marketing Intelligence)

```ts
type PatternCategory = "messaging" | "icp" | "objection" | "seo" | "geographic" | "competitive";
type PatternStatus = "new" | "reviewed" | "applied" | "dismissed";

interface IntelligencePattern {
  id: string;
  category: PatternCategory;
  summary: string;              // "5 prospects mentioned manual dispatching this week"
  confidence: "low" | "medium" | "high";
  evidence: string[];           // Fact/InboxEntry/WhatsAppMessageAnalysis ids or short quotes
  recommendation: string | null;
  status: PatternStatus;
  detectedAt: string;
}
```

Detected by a scheduled/manual-trigger pass (mirrors the Reality & Reconciliation Engine's own "manual trigger, not a background job" precedent, §2.5) that scans recent `Fact`/`InboxEntry`/WhatsApp-analysis content for repeated terms/themes — AI-assisted (an LLM call over a bounded recent-content window) with a deterministic keyword-frequency fallback per §6.

---

## 5. Subsystem-by-subsystem plan

Mapped directly to the brief's own 27 sections; each row states the real decision, not just restates the ask.

### 5.1–5.2 Command Strip (Directive / Weekly / Today targets)

New top section of `/admin/today`: the single active `Directive` (§4.1) pinned first, then a Weekly row (reads `GoalsConfig` + the existing `getWeeklyScoreboard()`), then a Today row (reads `GoalsConfig`'s per-weekday resolved set + today's actual counts). **Every count here already has a real source** (`Interaction` records by type, `Task`s by status) except demos/follow-ups-as-their-own-bucket, which need `Interaction.type`/`outcome` read more granularly than `getWeeklyScoreboard()` currently does (today it only distinguishes attempts vs. "meaningful") — a small, real extension to that function, not a new one.

### 5.3–5.4 Daily AI Team Briefing + completeness bars

`WorkerBriefing` (§4.2) + a `GET /api/admin/crm/team/briefing-status` route computing, per active `AiEmployee` with a `dailyRequiredInput` set, whether today's `periodKey` has a submitted `WorkerBriefing`. Rendered as the brief's own progress-bar-per-worker plus an overall "Intelligence completeness: 73%" line — **and, per the brief's own explicit instruction, this never blocks the rest of the page**: Today renders fully regardless of completeness, the same way `InsightsTab`'s alerts render even with zero AI configured.

### 5.5–5.6 Intelligence Ingestion + AI Daily Synthesis

The ingestion side needs no new pipeline (§2.3) — it needs a richer extraction schema (competitors/timeline/budget/decision-makers/unanswered-questions as named fields) added to `INBOX_EXTRACTION_SYSTEM_PROMPT`'s existing JSON contract, and it needs the daily-synthesis roll-up: a new prompt (`DAILY_SYNTHESIS_SYSTEM_PROMPT`) that takes today's `WorkerBriefing`-tagged entries plus recent WhatsApp analyses and produces the brief's own "today's intelligence changed: 3 prospect priorities, 1 messaging recommendation..." — one AI call, cached for the day (same `getStore()`/TTL pattern as `SystemState`), with a deterministic fallback (§6) that just lists the raw counts without the narrative framing when AI is down.

### 5.7 Daily Prospect Engine — the real center of gravity

Replaces Today's plain `dueBy` filter with a real ranking pass over the same already-fetched prospect list:

```
score = 0.25·icpFit + 0.20·engagement + 0.15·followUpUrgency
      + 0.15·buyingIntent + 0.10·strategicRelevance + 0.10·contactability + 0.05·recency
```

Weights live in config (extend `GoalsConfig` or a sibling `RankingWeights` key — same `getStore()` pattern), tunable from the same settings page as goals. Each component is a **deterministic** derivation from existing fields:

| Component | Deterministic source |
|---|---|
| `icpFit` | `Prospect.icpFitScore` (already exists) |
| `engagement` | live `Visitor`/`opportunityScore` link, see §5.16–19 |
| `followUpUrgency` | days since `nextActionDate` was due, `WhatsAppConversation.responseUrgency` if present |
| `buyingIntent` | `Prospect.opportunityScore` (already fed by WhatsApp buying signals) |
| `strategicRelevance` | active `Campaign`/`Directive` match on stated ICP terms (simple substring match against `location`/`estimatedFleetSizeRaw`/`primaryPainRaw`, not an AI call) |
| `contactability` | has phone / verified WhatsApp / email on file |
| `recency` | inverse days-since-last-contact |

AI's role here (per §6) is strictly additive: when configured, one AI call may **re-rank** the top ~15 deterministically-scored candidates down to 10 using richer judgment (an LLM reading the actual fact/note text, not just scores) — never compute the base score itself, and the deterministic ranking is always what ships when AI is unavailable, not a degraded stand-in.

### 5.8 Configurable goals

Covered in §4.3. Per-weekday overrides exactly as asked; historical-performance-based goal *suggestions* are AI-optional (§6) and always propose-only — Winston edits the actual config himself on the settings page, an AI suggestion never writes it directly.

### 5.9–5.10 Prospect mini-workspace cards + the Prospect page as a workstation

Today's card gains the fields the brief's §9 lists that already exist somewhere but aren't surfaced together yet (ICP tier from `icpFitScore` + `estimatedFleetSizeRaw`, live visitor intent if linked — §5.16, buying signals from recent WhatsApp analysis) — no new backend, a card layout revision. The Prospect page (§2.6) is restructured per the brief's §10 sketch: a persistent header strip (contact actions always visible, not buried in the Overview tab only), an "AI Brief" card promoted above the tabs, a side-by-side SDR/Sales-Coach panel sourced from the existing per-prospect `InboxEntry` history filtered by employee role, and the new Call Workspace (§5.11) as a sixth tab.

### 5.11 Call Mode ("karaoke")

`CallSession` (§4.6). A default deterministic script (Opening → Permission → Discovery → Pain confirmation → Qualification → Demo transition → Next step) with per-prospect substitutions (`{{contactName}}`, `{{knownPain}}` from `primaryPainRaw`/`intelligence.likelyPain`) filled in by plain string templating, not an AI call — an AI-authored opening line is an *optional* enhancement (§6: fallback is the deterministic template). Mobile-first per the brief's own instruction, one step full-screen at a time with Previous/Mark-complete, SDR/Coach intelligence in a collapsible side panel. Ending a call session (complete or abandon) drops straight into the existing "What happened?" outcome flow — no new logging path.

### 5.12 AI-assisted messaging (tone variants)

Extends the existing `WHATSAPP_DRAFT_SYSTEM_PROMPT`/email-draft pattern (SendWhatsAppPanel already has one-shot "AI draft"; email doesn't yet) with a tone-parameter argument (shorter / more conversational / more professional / less salesy / follow-up / first-contact / objection-response / meeting-request / re-engagement) folded into the prompt, plus a "why AI wrote this" one-liner returned alongside the draft (the model states its own reasoning in the same JSON response, not a second call). Fallback per §6: a small library of static templates per tone/purpose combination when AI is down — genuinely new content to write, not a code gap.

### 5.13 Conversation ingestion

Already built (§2.3) for free text; extends to accept a pasted WhatsApp export/email thread directly (light parsing to strip WhatsApp's own `[HH:MM, DD/MM/YY] Name:` line prefixes before handing to the existing extraction prompt) rather than a new ingestion path.

### 5.14–5.19 Visitor Intelligence expansion — now fully grounded (§2.7)

The reconciliation below replaces the earlier placeholder now that the underlying system has been read in full. Split cleanly into genuinely-new work and extensions of what already exists — the two categories need very different amounts of effort, and conflating them was the exact risk this document was trying to avoid.

**Already exists, no new backend needed:**
- The multi-layer identity model itself (Anonymous → Fingerprint → Session → Known contact/Lead). `identifyVisitor()`, session lifecycle, and `linkVisitorToLead()` already implement four of the brief's own five layers.
- The event/data model the brief sketches as "Visitor/Session/PageView/Event" — already built as `Visitor`/`VisitorSession`/`VisitorEvent` with page views folded into the 29-type `EventType` enum rather than split into a fourth collection (§2.7's own note on why this is a fine, arguably better, difference — not a gap to close).
- Deterministic engagement/intent scoring, referrer classification, funnel/content/campaign performance reads — all real, all reusable as-is by any new screen this document proposes.

**Genuinely new work — not a reshaping of anything that exists today:**

1. **A live visitor↔prospect link.** This is the one piece with a direct dependency from §5.7's ranking engine. Two viable shapes, not yet chosen: (a) keep `linkedVisitorId` as the pointer and have the Daily Prospect Engine's `engagement` component do a live read of that visitor's current `engagementScore`/recent `VisitorEvent`s at rank-computation time (cheap — Today already does a bounded fetch; this adds one more read per linked prospect), or (b) go further and have `recordEvent()` itself check whether the visiting fingerprint/session resolves to an already-linked prospect and write a lightweight "this prospect had new website activity" marker Today can surface without a full re-read. (a) is the smaller, safer first step and is what RS-4 should build; (b) is a real future enhancement, not required for the brief's own "reprioritize today's queue" ask.
2. **Account-level aggregation.** No `Company`/`Account` entity exists anywhere (§2.7) — this is a wholly new entity and a wholly new aggregation pass (grouping visitors by inferred company, likely via matched domain on a captured work email, or manual linking, since there's no reverse-DNS/company-enrichment API integrated anywhere in this codebase either). Scoped honestly, this is its own sub-project, not a checkbox inside RS-4 — see the open question in §8.
3. **Google Maps-based geographic intelligence.** Zero geocoding, zero maps SDK anywhere in the codebase today (§2.7). Building this for real needs: a lat/lng source (either IP-geolocation-provider coordinates captured at the same point `country`/`city` already are, or a client-side browser Geolocation-API prompt — the former is far more realistic given this is B2B site traffic, not a consented mobile app), a Maps Embed/JS API key (a real new cost line and a real new secret to manage, per this project's own credential-handling discipline), and a new map component — none of which exist as partial work to extend. Scoped as its own slice, gated behind Winston confirming the Google Maps API cost/key management is worth it for what's currently a country/city table that already works.

**Net effect on RS-4's scope (§7):** the phase splits cleanly into "the live link" (small, real, unblocks §5.7) and "account intelligence + maps" (large, genuinely new subsystems each). The rollout plan in §7 below reflects this split rather than treating RS-4 as one undifferentiated block.

### 5.20 Marketing Intelligence (`/admin/intelligence`)

New page, `IntelligencePattern` (§4.7), manual-trigger pattern detection (mirrors the Reality & Reconciliation Engine's own precedent) scanning recent `Fact`/`InboxEntry`/WhatsApp-analysis text for repeated terms, AI-assisted with a deterministic keyword-frequency fallback (§6). Review/Apply/Ignore per pattern, same discipline as every other AI proposal in this app — "Apply" on a messaging pattern writes a `Decision` (scoped global or by segment), never edits copy anywhere automatically.

### 5.21 SEO Intelligence — scoped down to what's actually captured, confirmed by §2.7's grounding

**No search-query data is captured anywhere in this codebase.** There's no Google Search Console integration, no keyword tracking, nothing that records what someone searched before landing on the site — the only traffic-source signal that exists is `classifyReferrer()`'s deterministic organic/paid/direct/social/referral bucketing (§2.7), plus whatever UTM parameters a link happened to carry and `getContentPerformance()`'s per-landing-page engagement numbers. That's real and useful (e.g. "organic-referred visitors convert at a higher rate than paid" is answerable today), but it is not "SEO intelligence" in the brief's own sense of keyword/ranking/search-visibility insight — that would need a genuinely new external integration (Search Console's own API, at minimum, which needs Google OAuth/service-account setup and its own credential-handling, another real new secret).

Scoped honestly for this document: §5.20's Marketing Intelligence page can and should surface what's already derivable (referrer-mix trends, which landing pages convert best, organic vs. paid performance) as one of its pattern categories — no new integration required for that slice. A genuine keyword/search-visibility feature is out of scope for this rollout entirely, not merely deferred to a later phase; it needs its own scoping conversation with Winston once the rest of this document's phases are further along, since it's a new external API relationship, not an extension of anything built so far.

### 5.22–23 Motivation, streaks, Victory Log

`VictoryLogEntry` (§4.5), a "Today's mission" strip (reuses `GoalsConfig` + today's actual counts — no new computation), streak counts derived from consecutive days each goal type was met (a bounded scan over recent `Interaction`s/`VictoryLogEntry`s, same as `getWeeklyScoreboard()`'s own pattern). A weekly "Weekly Wins" rollup (deterministic sentence built from counts, e.g. "You completed 47 prospecting actions...") — AI-optional narrative polish over the same numbers, per §6.

### 5.24 End-of-day AI debrief

Extends the existing End-of-Day Review (§2.2) — which already forces incomplete-task classification — with a synthesis pass (new prompt, `EOD_DEBRIEF_SYSTEM_PROMPT`) reading today's interactions/outcomes/`VictoryLogEntry`s and producing "what worked / what didn't / tomorrow's recommended focus," written as a `Directive`-adjacent note Tomorrow's Command Strip reads first. Deterministic fallback: the raw counts and a plain "N tasks incomplete, reasons: ..." summary, no narrative, when AI is unavailable.

### 5.25 Subsystem architecture / AI Orchestrator

Confirmed already the right shape (§2.2) — the Orchestrator, tool registry, and autonomy-level mechanism this whole app already runs on is exactly the "AI Orchestrator" box in the brief's own diagram. Every new AI touchpoint this document proposes (daily synthesis, ranking re-rank, message-tone generation, pattern detection, EOD debrief) is a **new prompt + a new call site**, not a new orchestration mechanism — `completeWithFallback()`/`pickToolAdapter()` stay the only two entry points to a provider anywhere in this app.

---

## 6. AI-availability & deterministic-fallback — a binding rule, formalized

Every AI-touching feature this document adds must ship with its deterministic fallback **in the same commit**, not as a follow-up:

| Feature | AI path | Deterministic fallback |
|---|---|---|
| Daily prospect ranking | LLM re-ranks top 15 → 10 | Weighted-sum score, unranked by AI at all |
| Daily synthesis | Narrative roll-up of today's briefings | Raw counts list, no narrative |
| Call Mode script | AI-personalized opening line | Static template with field substitution |
| Message composer | AI-generated draft per tone | A small static template library per tone/purpose |
| Marketing Intelligence patterns | LLM reads recent content for themes | Keyword-frequency clustering over the same content |
| Weekly Wins / EOD debrief | AI narrative | Plain counts sentence |
| Goal suggestions | AI-suggested targets from history | No suggestion shown; manual entry only |

**The system must never show "AI unavailable, feature disabled."** Every row above already has a working non-AI answer by design — the UI's job is to silently prefer the richer AI version when available and fall back without announcing a degradation as an error, matching `InsightsTab`'s own existing "AI insights temporarily unavailable" (informational, not blocking) precedent.

---

## 7. Phased rollout

Numbered `RS-0` through `RS-5` (Revenue System), following the `WA-0`..`WA-4`/Phase-0..3 numbering convention already established in this project.

```
RS-0 — Data model + Command Strip
  Directive, GoalsConfig (+ settings page), extend getWeeklyScoreboard()
  for calls/WhatsApp/emails/demos sub-counts
  Move Command Center content from /admin onto /admin/today (§3)

RS-1 — Daily Prospect Engine
  Deterministic weighted ranking (§5.7), replacing the plain dueBy filter
  Prospect mini-workspace card revision (§5.9)
  AI re-rank as an optional enhancement layer

RS-2 — AI Team Briefing + Intelligence Ingestion
  WorkerBriefing, completeness bars, richer extraction schema
  Daily AI Synthesis roll-up

RS-3 — Prospect page workstation + Call Mode
  Restructured Prospect page (§5.10), CallSession + Call Mode UI (§5.11)
  Tone-variant message composer (§5.12)

RS-4a — Live visitor↔prospect link
  linkedVisitorId live read into the ranking engine's `engagement` component (§5.14-19 option a)
  /admin/intelligence, IntelligencePattern (§5.20), scoped to referrer/content-performance
  patterns only (§5.21) — no Search Console integration
  Marketing Intelligence's referrer/landing-page pattern slice (§5.20/5.21)

RS-4b — Account intelligence + Google Maps geography (larger, separately scoped)
  Company/Account entity + aggregation pass (§5.14-19 item 2) — needs its own scoping
  pass with Winston before starting, per §8
  Google Maps geographic intelligence (§5.14-19 item 3) — needs a Maps API key/cost
  decision and a lat/lng data source decision before starting, per §8

RS-5 — Motivation + EOD debrief
  VictoryLogEntry, streaks, Weekly Wins
  End-of-day AI debrief synthesis (§5.24)
```

RS-4 is split into a small, well-understood slice (4a, unblocks §5.7's ranking engine) and a larger pair of genuinely-new subsystems (4b, account intelligence and Maps integration) that each deserve their own scoping conversation rather than being bundled sight-unseen — see §8.

---

## 8. Open questions & risks — flagged, not resolved here

- **§3's Command-Center-relocation is a real UX change Winston should confirm before RS-0 ships**, not just this document's own inference from his brief — moving System State/Daily Rhythm/the Orchestrator ask-box off `/admin` changes what every existing bookmark/muscle-memory click does.
- **Whether `Directive` should support more than one simultaneously-active entry** (the brief shows one "primary objective" but also a separate weekly objective) — modeled here as `weekOf: null` (standing) vs. `weekOf: <date>` (that week's), both allowed active at once; worth Winston's explicit confirmation this is the right shape before building the UI around it.
- **The deterministic ranking weights (§5.7) are a genuine judgment call with no existing data to validate against yet** — the brief's own suggested percentages are a reasonable starting point, not something this codebase has evidence for; expect to tune them after a few weeks of real use, the same "needs real data" caveat `ai-marketing-os-architecture.md` already applied to messaging-performance learning. **A real, newly-identified wrinkle from §2.7's grounding**: the existing visitor-scoring system already has the "weights can't be retroactively recalculated against historical data" limitation — worth designing the ranking-weights config (and any future re-tuning UI) to either accept that same limitation explicitly, or store enough raw signal to allow a recompute, rather than silently inheriting the same gap.
- **Account-level intelligence (§5.14-19 item 2) and Google Maps geography (item 3) need their own scoping conversations with Winston before RS-4b starts** — both are confirmed-from-zero new subsystems now that the grounding is complete (no `Company` entity exists at all; no geocoding/Maps integration exists at all), not extensions of anything already built. Specifically open: whether account matching should be domain-based (needs a captured work-email domain per visitor, which isn't captured today either) or manual; and whether a Google Maps API key/billing relationship is worth taking on for what's currently a working country/city table, or whether a lighter static-map/no-map alternative satisfies the actual need.
- **SEO Intelligence in the brief's own keyword/search-visibility sense is out of scope for this rollout** (§5.21) — it needs a new external integration (Search Console API at minimum) this codebase has no precedent for, distinct from the referrer/content-performance slice that ships as part of RS-4a.
