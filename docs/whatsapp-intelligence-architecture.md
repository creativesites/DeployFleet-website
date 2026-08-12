# DeployFleet WhatsApp Intelligence & Outreach Automation — Architecture & Phased Plan

**Status: all five sub-phases (WA-0 through WA-4) are built.** Written first as a planning document (per the same discipline `docs/ai-marketing-os-architecture.md` was written under), then implemented in full in the same session per Winston's explicit "implement all phases in a single session...for any open questions, implement your recommendations." §15's open questions are resolved with concrete decisions, not left open. **Two things remain genuinely outside what this repo/dev environment can complete**, and stay disclosed here rather than silently assumed done: a live Baileys↔WhatsApp connection (needs a real phone to scan a QR code) and an actual deployment of `whatsapp-service/` to live hosting (needs hosting-provider credentials). Every DeployFleet-side feature degrades gracefully — "gateway not configured" — until both are completed manually; see `whatsapp-service/README.md`.

**This is Phase 4 of the AI Marketing OS**, sitting on top of Phases 0–3 (`docs/ai-marketing-os-architecture.md`), all of which are built: Pipeline/Targets/Outreach, the Fact/Task/Decision/AuditEvent data model, the Context Compiler, the AI Inbox, the Orchestrator with tool-calling and autonomy levels, System State, the Command Center, and the anti-procrastination engine. This document explicitly **supersedes** one line from that doc's §3 and §12: *"No call automation anywhere, ever — calls and WhatsApp stay entirely human-mediated."* That was correct as the scope stood at the time; Winston has now asked for controlled WhatsApp automation specifically (not calls — calls remain out of scope everywhere in this plan too). Flagged explicitly rather than silently diverging, per this project's own standing rule for exactly this situation.

**Audience:** whoever (human or AI) picks up implementation next. Every section is written to be directly actionable — concrete files (in both repos), concrete data model, concrete phase boundaries — not just the vision language it's synthesized from.

---

## 0. Where this comes from

Winston supplied a 16-section vision brief for a WhatsApp Intelligence & Outreach layer, opening with an explicit instruction:

> The important part is to learn from what we've already built with Zuri, rather than rebuilding WhatsApp infrastructure from scratch.

Zuri (`creativesites/Personal-Assistant`) is Winston's own separate, mature product — a personal/business relationship-and-communication OS with a full, hardened WhatsApp stack (Baileys transport, session management, message pipeline, AI conversation analysis) built and running in production. This document is that brief, reconciled against **an actual read of both codebases** — not the brief's own architecture sketch taken on faith — and organized into a phased plan following the same "ground it, then plan it" discipline `ai-marketing-os-architecture.md` used for Phase 0–3.

A second brief (titled "concrete porting and architecture plan," included in Winston's message) already did a first pass at this same audit and arrived at broadly the same conclusions this document does independently, after reading the actual files. Where this document's own read of the code confirms, refines, or corrects that brief, it says so explicitly rather than silently merging the two.

---

## 1. Governing vision & north star

Winston's own framing, verbatim, is the right one to hold onto through every section below:

> Don't build WhatsApp as a separate messaging app. Treat it as another source of truth entering the DeployFleet OS.

And, on pacing:

> I'd actually make the WhatsApp AI have explicit operating modes... This gives you a gradual path toward automation instead of immediately giving an LLM unrestricted access to WhatsApp.

The operating loop this phase exists to run — Winston's own diagram, unchanged, because it's exactly right and it's the same closed loop the rest of the AI Marketing OS already implements for every other channel:

```
OUTBOUND → MESSAGE → RESPONSE → AI UNDERSTANDS → CRM UPDATED
   → PROSPECT SCORE UPDATED → NEXT ACTION CREATED → WINSTON PUSHED
   → OUTCOME RECORDED → SYSTEM LEARNS
```

The system's job, per Winston's own §7, "isn't to maximize messages. It's to maximize meaningful progress." Every design decision below is judged against that line specifically, not against "how much can be automated."

---

## 2. Current state — what actually exists today, in both repos

Grounding before design. This section is the load-bearing part of the document — every recommendation past this point traces back to a specific line of real code, not an assumption about what "probably" exists.

### 2.1 DeployFleet today

**Data model already in place that this phase extends, not replaces** (`src/lib/crmTypes.ts`, `src/lib/crm.ts`):
- `Prospect.phoneClassification: PhoneClassification | null` — `{type: "landline"|"mobile"|"unknown", carrier: "Airtel"|"MTN"|null, recommendedChannel: "call"|"whatsapp", patternAnomaly: boolean}`. This is a **rule-based number-shape classifier** (`src/lib/phoneRules.ts`) — carrier prefixes, landline ranges, round-number/sequential-digit anomaly flags. It has never made a live network call to anything. It cannot tell you whether a number is actually reachable on WhatsApp today; it only guesses "mobile numbers from these prefixes are usually WhatsApp-capable."
- `Interaction.type` already includes `"whatsapp"` as a value in the `InteractionType` union, alongside `call`/`email`/`visit`/`demo`/`note` — but every existing WhatsApp interaction in this system is logged **after the fact, by Winston, by hand** (a `wa.me` deep link opens WhatsApp's own app; DeployFleet has no idea what was actually said).
- The **Fact ledger** (`Fact`, append-only, `factType`/`key`/`value`/`source`/`sourceType`/`confidence`/`status`/`supersedes`), the **Task** entity (assignable to a prospect or an AI employee, `TaskCreatedBy` includes `"ai_inbox_extraction"`/`"ai_orchestrator"`/`"ai_reconciliation"`), the **Decision Ledger** (never edited, only superseded, `DecisionScope` of `global`/`prospect`/`employee`), and the append-only **AuditEvent** trail — all built in Phase 1, all schema-ready to receive WhatsApp-sourced writes with zero changes.
- The **AI Inbox** (`src/app/api/admin/crm/inbox/route.ts`, `INBOX_EXTRACTION_SYSTEM_PROMPT`) is DeployFleet's own already-proven pattern for "raw text in, structured facts/tasks/decisions/risks/recommendations/contradictions out, reviewed before anything writes." This is the *exact* shape Winston's §4 (`"WhatsApp Becomes a CRM Activity Source"`) and §7 (`"AI Should Detect Buying Signals"`) are asking for — the extraction pipeline this phase needs is a specialization of one that already exists and already works this way, not a new pattern.
- The **Orchestrator** (`src/lib/ai/orchestrator.ts`) has real, working tool-calling (§5.4/§8.1 of the base doc) against both DeepSeek (OpenAI-compatible `tools`/`tool_calls`) and Gemini (`functionDeclarations`/`functionCall`), a fixed 11-tool registry, and — critically for this phase — a real, working **autonomy-level mechanism**: every write-capable tool defaults to Level 0 ("propose, Winston approves"), returning a structured proposal card rather than executing, with a hard floor that some actions (prospect stage past "Qualified") can never be auto-approved regardless of configuration. This is the exact ladder Winston's §5/§6 (`"Don't Let AI Automatically Send Everything"` / `"Response Modes"`) is asking this phase to build — it already exists; this phase reuses it rather than inventing a parallel concept.
- **System State** (`src/lib/ai/systemState.ts`) and the **Command Center** (`src/components/admin/CommandCenter.tsx`) already compute "biggest bottleneck," "top prospect by opportunity," and "top risk flag" and surface them proactively — the exact mechanism Winston's §10 (`"WhatsApp + Anti-Procrastination"`) example walks through ("Winston, Yeshua Logistics is WhatsApp-verified... no outreach has been made") is describing this system with one more data source feeding it, not a new system.
- The **EmailSend precedent** (`src/lib/email/emailjs.ts`, `POST /api/admin/crm/email/send`, built the session immediately before this document) is the closest existing analog for "controlled outbound to an external channel, capped, logged, server-side-enforced" — the daily-cap-and-audit-trail pattern this phase's §15 (`"Compliance & Operational Safety"`) asks for already has one real, shipped precedent to copy the shape of.
- **What does not exist at all**: any live check of whether a phone number is reachable on WhatsApp; any WhatsApp message transport (send or receive); any persistent connection/session infrastructure of any kind (DeployFleet is 100% Vercel serverless functions — see §13 on why that matters a great deal here); any conversation store; any Baileys dependency.

### 2.2 Zuri today — read directly, not assumed

`creativesites/Personal-Assistant` — a Turborepo monorepo: `apps/{web,mobile,companion}`, `services/{api,whatsapp,intelligence}`, `packages/{shared-types,pdf-templates}`, Postgres (`db/migrations/`, 125+ migrations) + Redis + BullMQ. `services/whatsapp` is Node/TypeScript; `services/intelligence` is a separate Python FastAPI service. This is a real, multi-service, multi-database production stack — a materially heavier architecture than DeployFleet's single Next.js app on Firestore, which matters directly for §13's hosting decision below.

**The transport abstraction is exactly what Winston's §13 asked for, and it already exists** (`services/whatsapp/src/transport/types.ts`): an abstract `WhatsAppTransport` class (extends `EventEmitter`) that the rest of the service talks to — `start()`, `stop()`, `sendText()`, `sendReaction()`, `deleteMessage()`, `fetchProfilePictureUrl()`, `postStatus()`, `sendPresenceUpdate()`, `sendDocument()`, `listCatalogProducts()`/`createCatalogProduct()`, `requestLinkCode()`, `getStatus()`, `fetchRecentMessages()` — plus typed events (`qr`, `connected`, `disconnected`, `message`, `historical_message`, `historical_batch`, `link_code`). `services/whatsapp/src/transport/baileys.ts` (795 lines) is the one concrete implementation. **This is the single most valuable, most directly reusable artifact in either repo for this phase** — it's already a clean interface, not something that needs to be extracted from tangled code first.

**Session management** (`services/whatsapp/src/lib/session-manager.ts`, 779 lines) is real, hardened, production-tested infrastructure: QR/pairing-code generation with TTLs, auto-restore-on-boot from saved credential files, reconnect handling, a debounced history-sync trigger, presence and delivery-status tracking, and — worth calling out since it directly informs this phase's own reconciliation needs — a self-healing job that, on every reconnect, re-verifies the 20 most-recently-active chats to recover any messages missed while the socket was offline (`RECONCILIATION_VERIFY_CHAT` BullMQ queue). This class of bug (missed messages during a disconnect window) is not hypothetical; Zuri hit it in production and built a specific fix for it.

**Message intake** (`services/whatsapp/src/lib/message-handler.ts`, 470 lines) — `handleMessage()`: upsert contact by WhatsApp JID → upsert conversation → insert message (deduped on `(conversation_id, whatsapp_message_id)`) → push a job onto a BullMQ `MESSAGES_INCOMING` queue for async AI analysis → publish a Redis pub/sub event for the web app's real-time UI. A separate `writeHistoricalMessage()` path skips the queue/pub-sub entirely for bulk historical import. A `derivePriority()` heuristic (`hot_lead`/`ready_to_buy`/`dissatisfied`/`needs_followup`/`loyal`/`waiting`, derived from lead score + latest intent + urgency + sentiment + how long a response has been pending) is a small, clean, directly-portable pattern for exactly the "which conversation needs Winston's attention right now" question this phase's §10 needs answered.

**Conversation intelligence** (`services/intelligence/app/services/analyser.py`, 396 lines) is a single LLM call per message (`UNIFIED_SINGLE_PASS_COGNITION` prompt) that returns one XML-wrapped JSON blob: `sentiment`, `sentiment_score`, `emotions` (joy/sadness/anger/fear/surprise), `intent` (`{category, confidence}`), `topics`, `entities`, `importance_score`, `requires_response` (boolean), `response_urgency` (`low`/`medium`/`high`/`urgent`), `promises_detected`, `events_detected`, `summary` — stored in a `message_analyses` table (see schema below). Optionally, in the same call, it also generates 3 reply suggestions (`<response>` tag) — but only when explicitly asked (`generate_reply=True`), and even then those suggestions are written to a `suggested_replies` table with `status = 'pending'`, never sent automatically. **This confirms Winston's §5/§6 instinct was already independently validated in Zuri's own design**: even Zuri, a more mature and more autonomous-leaning product, gates every generated reply behind an explicit pending/approved/sent state machine (`reply_status` enum) rather than sending on generation.

One genuinely interesting piece worth citing directly: Zuri's analyser has an **auto-quote-detection engine** — when a contact's message contains pricing keywords (`quote`, `price`, `how much`, ...), it drafts a quotation from the catalog and adds it to a `proactive_queue` table with `status = 'pending'`, never sending it. This is the same "detect a signal, prepare the artifact, never auto-send" shape DeployFleet's own Orchestrator already implements for its 8 write-capable tools — independent confirmation, again, that the propose-then-approve default is the right one, not an overcautious one.

**Lead scoring** (`services/intelligence/app/services/lead_score.py`, 47 lines) is worth reading in full because of its own documented history: it used to be written *only* by an AI agent's tool call, which almost nobody configured, so the field silently sat at 0 for nearly every contact — quietly breaking every pipeline/opportunities view that read it. It was rewritten to compute directly from an `opportunities` table (`buying_signal`/`expansion`/`referral_moment`/`renewal_due` types, each carrying a `confidence`), with **no agent or opt-in required** — score is simply the strongest open opportunity's confidence, scaled 0–100. This is a direct, load-bearing lesson for this phase: **buying-signal detection must write into a real, always-on table/field DeployFleet's existing scoring already reads (`Prospect.opportunityScore`, already built in Phase 1) — never gated behind an optional feature nobody enables.**

**Postgres schema actually read** (`db/migrations/0004_conversations.sql`): `conversations` (per `(user_id, whatsapp_chat_id)`, unread count, archive/mute flags), `messages` (per `(conversation_id, whatsapp_message_id)`, sender type, message type, body, media, quoted-message FK, deletion flag), `message_analyses` (1:1 with `messages`, the fields listed above, plus a `pgvector` embedding column for semantic search), `suggested_replies` (1:many, `reply_status` enum: `pending`/`approved`/`sent`/`dismissed`/`edited_and_sent`).

**What genuinely does not exist yet, even in Zuri — confirmed by grep, not assumed absent:** there is no `onWhatsApp`/number-existence-check method anywhere in `services/whatsapp/src` or `services/api`. Baileys the *library* supports this primitive (`sock.onWhatsApp(...)`), but Zuri has never wired it into a route, a transport method, or a stored field. **Winston's §1 ("WhatsApp Number Intelligence") is not something to port from Zuri — it is new work in both repos, using a capability the underlying library already exposes but neither product has used yet.** Said plainly here so it isn't discovered as a surprise mid-implementation, the same discipline every prior phase in this project has followed.

**What this document deliberately does not recommend porting, and why:** Zuri's multi-tenant billing/subscription lifecycle, career-coaching/CV/job-scraping surfaces, the full "relationship OS" (birthdays, gossip detection, spiritual companion, voice builder), group-chat product features, and the Python service's much heavier context-gathering for reply generation (live web search, KB retrieval, product catalog, relationship memory, "user voice" style modeling) — all real, all working, all out of scope for a B2B outbound sales tool with one user. DeployFleet's own Context Compiler (§7.6 of the base doc) already does the equivalent "assemble bounded, relevant context for an AI call" job, scoped to what a sales conversation actually needs (prospect facts, open tasks, recent interactions, `Fact` history) — reuse that, not Zuri's much larger memory stack.

---

## 3. Architecture overview

Winston's own diagram (§13) is correct and is the one to build to, with one necessary addition: DeployFleet's own AI Marketing OS sits *below* the "DeployFleet OS" box, as the actual consumer of everything the WhatsApp layer produces.

```
                    DeployFleet AI Marketing OS
        (Prospects · Facts · Tasks · Decisions · Orchestrator ·
              System State · Command Center — all built)
                              │
                    new tools + a new Fact/Task
                    source, same as the AI Inbox
                              │
              ┌───────────────▼────────────────┐
              │   WhatsApp Communication Layer   │   NEW — this phase
              │  (a DeployFleet-owned service,   │
              │   ported/adapted from Zuri)       │
              │                                  │
              │  checkAvailability()  sendMessage()│
              │  onMessage()  getConversation()   │
              └───────────────┬────────────────┘
                              │
                         Baileys (ported from Zuri,
                         same abstraction boundary)
                              │
                          WhatsApp
```

The key architectural fact, unchanged from Zuri and unavoidable for DeployFleet too (§13 below): **the WhatsApp Communication Layer cannot live inside DeployFleet's Next.js app on Vercel.** Baileys holds a persistent WebSocket to WhatsApp's servers and needs local disk for session credentials — both fundamentally incompatible with Vercel's stateless, time-limited serverless functions. This is not a DeployFleet-specific problem; it's why Zuri itself runs `services/whatsapp` as its own always-on process, separate from `apps/web`. DeployFleet needs the same shape: a small, separate, always-on service that DeployFleet's Next.js app talks to over HTTP/webhooks, never the other way around.

---

## 4. Port vs. adapt vs. build new

The honest classification, one row per real capability, each traced to the file read in §2.2:

| Capability | Zuri source | Decision | Reasoning |
|---|---|---|---|
| `WhatsAppTransport` abstract interface | `transport/types.ts` | **Port near-verbatim** | Already exactly the right abstraction boundary; no DeployFleet-specific concept leaks into it |
| Baileys implementation | `transport/baileys.ts` | **Port, then simplify** | Multi-session/multi-tenant bits (this phase is single-number, single-user — see §14 WA-0) can be stripped; connection/reconnect/QR/media logic stays |
| Session manager | `lib/session-manager.ts` | **Port, then simplify** | Same simplification — one session (Winston's DeployFleet outreach number), not a `Map<userId, session>`. Keep the reconnect self-healing job (§2.2) — it's solving a real, already-proven bug class |
| Message intake write-path shape | `lib/message-handler.ts` | **Adapt** | The upsert-contact → upsert-conversation → insert-message → analyse → publish sequence is right; repoint every write from Postgres tables to DeployFleet's own collections (§5), and from a BullMQ queue to a direct, synchronous call (§7 — DeployFleet's volume doesn't need a queue) |
| `derivePriority()` heuristic | `lib/message-handler.ts` | **Adapt** | Directly portable logic, rescoped to DeployFleet's own `riskFlags`/`opportunityScore` vocabulary instead of inventing new labels |
| Single-pass structured analysis shape | `analyser.py` | **Adapt heavily** | The *output schema* (sentiment/intent/entities/promises/urgency/requires_response) is the right shape and maps closely onto the AI Inbox's own `ExtractionResult`; the *prompt* and *context-gathering* are Zuri-specific (user voice, KB, catalog, relationship memory) and get replaced with DeployFleet's Context Compiler |
| Reply-suggestion generation + pending-state gating | `analyser.py`, `suggested_replies` table | **Adapt** | Confirms the right default (never auto-send); DeployFleet already has an equivalent mechanism (Orchestrator proposals) to reuse instead of a new table |
| Lead-scoring-from-signals pattern | `lead_score.py`, `opportunities` table | **Adapt** | The lesson (score from an always-on table, never an opt-in agent) applies directly to writing into `Prospect.opportunityScore`, which already exists |
| Auto-quote-on-pricing-keyword detection | `analyser.py` | **Inspiration only, not ported** | DeployFleet has no product catalog/quoting system; the *pattern* (detect a signal → prepare an artifact → queue for approval) is what transfers, via the Orchestrator's existing proposal mechanism |
| WhatsApp number-existence check | *(does not exist in Zuri)* | **Build new, in both repos eventually** | Baileys the library supports it; neither product has wired it up. DeployFleet builds it first, scoped to what it needs (§6) |
| Postgres schema (`conversations`/`messages`/`message_analyses`/`suggested_replies`) | `db/migrations/0004_conversations.sql` | **Translate, not copy** | DeployFleet stays on Firestore (§13's storage decision) — same conceptual shape, different collections (§5) |
| Multi-tenant billing, career/CV/job-scraping, full relationship OS, group chat | throughout `services/intelligence` | **Do not port** | Out of scope; see §2.2's closing paragraph |

---

## 5. Data model

New Firestore collections, following the exact conventions every prior phase in this project has used: `createdAt`/`updatedAt` as `Timestamp`, ISO strings at the type layer, broad-fetch-then-filter-in-memory where the query shape allows it. Translated from Zuri's Postgres schema (§2.2), not copied — Firestore's document model and DeployFleet's existing `Prospect`-centered vocabulary both shape this differently than Zuri's relational `contacts`/`conversations` tables did.

### 5.1 Extending `Prospect`

```ts
interface Prospect {
  // ...all existing fields unchanged...

  whatsappStatus: "verified" | "unavailable" | "unknown";
  whatsappVerifiedAt: string | null;        // ISO — freshness-bounded, see §6
  whatsappJid: string | null;                // e.g. "260979046745@s.whatsapp.net", once known
}
```

Deliberately *not* a new top-level `PhoneClassification`-style nested object — these three fields are simple, frequently-filtered-on (e.g. "show me verified-WhatsApp prospects with no outreach yet," directly answering Winston's own §10 morning-brief example), and belong at the top level the same way `stage`/`priorityScore` do.

### 5.2 Multiple contacts per prospect

Winston's §2 example ("Reception / Operations Manager / Unknown, each with their own number and WhatsApp status") needs more than one phone per prospect — something `Prospect` today doesn't model (it has exactly one `contactPhone`). Rather than force multi-contact into `Prospect` itself, a new collection:

```ts
interface ProspectContact {
  id: string;
  prospectId: string;
  name: string | null;            // "Operations Manager", or a real name once known
  role: string | null;
  phone: string;
  whatsappStatus: "verified" | "unavailable" | "unknown";
  whatsappVerifiedAt: string | null;
  whatsappJid: string | null;
  isPrimary: boolean;             // exactly one true per prospect at a time
  discoveredVia: "manual" | "whatsapp_referral" | "ai_inbox_extraction";
  createdAt: string;
}
```

`discoveredVia: "whatsapp_referral"` exists specifically for Winston's own §3 example — "I'm not the person handling fleet operations, here's his number" becomes a new `ProspectContact` row, a `Fact` (`factType: "contact_info"`), and a `Task` ("Contact Operations Manager"), exactly as described, using machinery (`Fact`/`Task` creation) that already exists.

### 5.3 `whatsappConversations` and `whatsappMessages`

```ts
type ConversationState =
  | "new" | "outreach_sent" | "awaiting_response" | "responded"
  | "qualification" | "discovery" | "interested"
  | "demo_requested" | "demo_scheduled"
  | "proposal" | "negotiation"
  | "won" | "lost" | "nurture"
  | "closed" | "waiting_for_human_action"; // §7's "don't reply to 'okay thanks'" states

interface WhatsAppConversation {
  id: string;
  prospectId: string;
  prospectContactId: string | null;  // which of the prospect's numbers, once ProspectContact exists
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

interface WhatsAppMessage {
  id: string;
  conversationId: string;
  waMessageId: string;               // Baileys' own id — dedupe key alongside conversationId
  senderType: "prospect" | "winston" | "ai_draft";
  body: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  whatsappTimestamp: string;
  createdAt: string;
}

interface WhatsAppMessageAnalysis {
  id: string;
  messageId: string;                 // unique — 1:1 with WhatsAppMessage
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  intent: { category: string; confidence: number };
  entities: { type: string; value: string }[];
  buyingSignals: BuyingSignalType[];  // §10
  requiresResponse: boolean;
  responseUrgency: "low" | "medium" | "high" | "urgent";
  summary: string;
  analyzedAt: string;
}
```

No `pgvector`-equivalent embedding field — matching the base doc's own already-made §12 decision ("no vector store or embedding pipeline is proposed anywhere in this plan... should hold fine at this system's actual scale"). Semantic search over WhatsApp history is a real thing Zuri has and DeployFleet is deliberately not building yet.

### 5.4 `whatsappSends` — the outbound-cap ledger

Directly modeled on the just-shipped `EmailSend` (§2.1) — same shape, same reasoning (every attempt logged, only successful sends count against a cap):

```ts
type WhatsAppSendStatus = "sent" | "failed";

interface WhatsAppSend {
  id: string;
  prospectId: string;
  conversationId: string;
  recipientJid: string;
  messageBody: string;
  isFirstOutreach: boolean;          // first message ever to this JID — the highest-risk send, see §11
  approvedBy: "winston";             // always — see §8, nothing sends without approval in this phase's scope
  status: WhatsAppSendStatus;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
}
```

### 5.5 What reuses existing collections, unchanged

- **`facts`** — every extracted fact (fleet size mentioned in a WhatsApp message, a newly-discovered contact, a pain point) writes here exactly as the AI Inbox already does, `source: "WhatsApp conversation, 11 Aug"`.
- **`tasks`** — every commitment ("call me tomorrow morning") and every referral ("contact the Operations Manager") becomes a `Task`, `createdBy: "ai_inbox_extraction"` (or a new `"whatsapp_intelligence"` value added to `TaskCreatedBy` — see §7).
- **`decisions`** — a WhatsApp conversation revealing something strategic ("this ICP segment consistently has 15+ trucks") can produce a `Decision`, scoped to the prospect, exactly like an Inbox-derived one.
- **`auditEvents`** — every verification, every send, every state transition, every extraction gets one, with a handful of new `AuditEventType` values added (`whatsapp_verified`, `whatsapp_sent`, `whatsapp_message_received`, `whatsapp_conversation_state_changed`).
- **`Prospect.opportunityScore`** — buying signals (§10) write here directly, the same field the Orchestrator's `generate_pipeline_report` and Command Center's "top prospect" tile already read. No new scoring field needed.

---

## 6. WhatsApp Number Intelligence

Per Winston's §1, with the one correction from §2.2/§4: this is genuinely new engineering, using a Baileys library primitive (`onWhatsApp`) neither product has wired up yet.

```
+260 XXX XXX XXX
      ↓
transport.checkAvailability(phone)  →  Baileys' sock.onWhatsApp()
      ↓
{ exists: boolean, jid: string | null }
      ↓
Prospect.whatsappStatus = "verified" | "unavailable"
Prospect.whatsappVerifiedAt = now
Prospect.whatsappJid = jid
```

**Freshness, not permanent truth — exactly Winston's own instruction.** A verification result is treated as stale after a configurable window (default 30 days, matching Winston's own number) and is **always** re-checked immediately before initiating outreach, regardless of staleness — a number that churned SIM cards or dropped WhatsApp between verification and send is exactly the failure mode this guards against. `whatsappStatus: "unknown"` is the default for every prospect until a check actually runs — never inferred from `phoneClassification`'s rule-based guess, which stays a *recommendation* input (§2.1) feeding which channel to try, not a substitute for a real check.

This capability needs the WhatsApp Communication Layer (§3/§13) to exist first — a verification call still requires a live, connected Baileys session, same as sending. It cannot be built as DeployFleet-only logic.

---

## 7. Conversation intelligence — WhatsApp as an AI Inbox source

Winston's §4 is, almost word for word, a description of the AI Inbox's own flow (`docs/ai-marketing-os-architecture.md` §7.1) with the input source swapped:

```
WhatsApp message arrives (via the Communication Layer's webhook/event)
   ↓
Identify prospect + conversation (§5.3)
   ↓
Store WhatsAppMessage
   ↓
WHATSAPP_ANALYSIS_SYSTEM_PROMPT (new, ai/prompts.ts) — same structured-JSON
pattern as INBOX_EXTRACTION_SYSTEM_PROMPT, run against the Context Compiler's
existing compileProspectContext() output, not Zuri's much larger context stack
   ↓
Extraction result: facts, tasks, decisions, buyingSignals, risks,
conversationStateHint, requiresResponse, responseUrgency
   ↓
Review-then-apply — reuses the AI Inbox's exact apply mechanism
(POST .../inbox/[id]/apply), not a new write path
```

**One deliberate difference from the plain AI Inbox, and from Zuri's own always-synchronous-per-message analysis**: DeployFleet's real volume here (Winston's own outbound cold list, dozens of prospects, not a consumer messaging product) does not need Zuri's BullMQ queue. The Communication Layer's webhook handler calls DeployFleet's extraction endpoint directly and synchronously, the same way `POST /api/admin/crm/inbox` already runs extraction inline in the same request rather than queuing it. If real volume ever proves this wrong, a queue is a scoped addition later — not a Phase 4 requirement, matching the base doc's own "don't build for hypothetical future requirements" discipline.

**`TaskCreatedBy` gains one new value**: `"whatsapp_intelligence"`, alongside the existing `"ai_inbox_extraction"`/`"ai_orchestrator"`/`"ai_reconciliation"` — so a task's provenance stays honest about which pipeline actually created it, even though the underlying mechanism (structured extraction, human review before apply) is shared with the Inbox.

**"Don't reply to 'okay thanks'" (§7 of Winston's brief) is a conversation-state decision, not a suppressed-AI-call decision.** Every inbound message still gets analyzed (cheap, useful for the record even when no action follows) — what changes is whether the analysis concludes `requiresResponse: false` and the conversation moves to `closed`, versus `requiresResponse: true` with a `Task` and a move to `waiting_for_human_action`. The AI is never in a "should I skip analyzing this" decision; it's always in a "does this need action" decision, which is a cleaner, more auditable place to draw that line.

---

## 8. Response modes — mapped onto the Orchestrator's existing autonomy ladder, not a parallel one

Winston's §6 names four modes (Copilot, Auto-Draft, Supervised Autonomy, Autonomous). Rather than build a second permissions concept, these map directly onto the Orchestrator's already-shipped Level 0–4 scale (`docs/ai-marketing-os-architecture.md` §8.2, `src/lib/ai/orchestrator.ts`'s `TOOL_REGISTRY`):

| Winston's mode | Orchestrator level | What it means here | Phase this ships in |
|---|---|---|---|
| **Copilot** | Level 0 | AI drafts, analyzes, flags — every `send`/`draft-and-send` action is a proposal card, Winston clicks Approve, exactly like every existing Orchestrator write tool today | WA-0 through WA-3 — the **only** mode in scope for this entire document |
| **Auto-Draft** | Level 0, UI-only distinction | A draft is pre-filled in the compose box before Winston even asks — same Level 0 execution, a UX nicety layered on top | WA-3, optional |
| **Supervised Autonomy** | Level 1, one narrow allow-listed reply class at a time | e.g. auto-sending a plain acknowledgment to a plain acknowledgment ("Got it, thanks!" → "👍") — the single lowest-risk, most reversible class, mirroring exactly how the Orchestrator's own `flag_stale_information` earned Level 1 (writes only low-stakes audit-log-shaped data) | Explicitly **not scoped** in this document — a future decision, made only after weeks of Copilot-mode data exist to justify it, per Winston's own §5 sequencing |
| **Autonomous** | Level 2+ | Multi-turn conversations within strict boundaries | **Out of scope everywhere in this document** — not sketched, not designed, flagged the same way the base doc flags `aiEmployees` as "not autonomous agents with their own runtime" |

**The hard floor already built for `update_prospect` (never auto-approve a stage change past "Qualified") gets a WhatsApp-specific sibling**: **the first outbound message to any prospect is always Level 0, permanently** — not a setting that could ever be flipped, the same category of non-negotiable Winston's own §5 lists first ("first outbound message... require approval"). Pricing, negotiation, proposals, and anything with a contractual claim are the same permanent floor, mirrored from Winston's own list verbatim into the tool registry's design.

---

## 9. Conversation state machine

Winston's own §8 diagram, adopted as specified, stored as `WhatsAppConversation.state` (§5.3). Two implementation notes:

- **Every transition is logged** — an `AuditEvent` (`eventType: "whatsapp_conversation_state_changed"`, `metadata: {from, to, evidence}`), not just an overwritten field, so "why did this move from Discovery to Interested" is answerable from stored data alone (the base doc's own §10 explainability requirement, extended here).
- **The state is AI-suggested, not AI-decided** for any forward transition past `responded` — the extraction pipeline (§7) proposes a state per Winston's own line ("The AI should determine when the conversation moves between states based on evidence"), but writing it follows the same Level 0 default as everything else in this phase until there's a track record to trust it unsupervised. `new → outreach_sent → awaiting_response → responded` are the only transitions safe to apply automatically from the start, since they're driven by DeployFleet's own actions (a send, a received message), not an inference about the prospect's intent.

Whether/how this state machine reconciles with the existing 13-stage `Prospect.stage` pipeline is a real open question, flagged in §15 rather than silently decided — they're related but not identical (a `WhatsAppConversation` can be `interested` while the `Prospect` itself hasn't moved past `Discovery`, if e.g. a second stakeholder needs to sign off).

---

## 10. Buying-signal detection → prospect scoring

Winston's §9 list (pricing question, demo request, fleet-size mention, referral request, pain-point admission, explicit follow-up commitment) becomes a fixed, hand-written enum — the same "small, hand-written registry, never freeform" discipline the Orchestrator's own tool list already follows, for the same reason (an LLM-classified signal type should come from a closed set a human reviewed, not an open string):

```ts
type BuyingSignalType =
  | "pricing_inquiry" | "demo_request" | "fleet_size_disclosed"
  | "internal_referral" | "pain_point_admission" | "explicit_commitment"
  | "competitor_mentioned" | "budget_mentioned";
```

Per §2.2's lead-scoring lesson (score from an always-on field, never an opt-in agent): every detected signal, from the very first WA-2 build, writes directly into `Prospect.opportunityScore` (already built, already read by System State and the Command Center) — there is no "turn on scoring" step to forget to flip, and no second, competing score field to keep in sync with the first.

---

## 11. Safety & compliance — non-negotiable from day one

Winston's §15 list, each mapped to a concrete mechanism rather than left as a principle:

| Safeguard | Mechanism |
|---|---|
| Daily sending limits | `WhatsAppSend` count-today check, server-side, in the same request as the send — identical pattern to `EmailSend`'s already-shipped 20/day cap (§5.4) |
| Per-prospect cooldowns | A minimum interval (default: no more than one outbound message per prospect per 24h) checked against `WhatsAppSend` before any send executes |
| Opt-out detection | A message matching an opt-out pattern (`"stop"`, `"unsubscribe"`, explicit "don't contact me") sets a permanent `Prospect.whatsappOptedOut: boolean` flag; the send path refuses unconditionally once set — **never automatically re-messaged, ever, no override**, exactly Winston's own line |
| Duplicate-message detection | `(conversationId, waMessageId)` uniqueness at the storage layer, the same dedupe key Zuri already uses (§2.2) |
| Human approval | §8's Level 0 floor — every send everywhere in this document's scope |
| Conversation pacing | The per-prospect cooldown above, plus never batch-composing more than one message per Approve click — no "send to 20 prospects" bulk action exists anywhere in this design |
| No bulk blasting | Same as above — structurally impossible, not just policy, since every send path is one `WhatsAppSend` row per Approve click tied to one conversation |
| Contact suppression | The opt-out flag, checked at the very top of every send-initiating code path, not just the UI |
| Audit logs | `AuditEvent` on every verification, send, and state transition (§5.5) |

---

## 12. Integration with the existing AI Marketing OS

Nothing here is a new subsystem — everything is a new input to systems that already exist:

- **Three new Orchestrator tools**, following the exact registry shape every existing tool already uses (`kind: "propose"`, `autonomyLevel: 0`, a `describeProposal()` function, no execution): `draft_whatsapp_message`, `send_whatsapp_message` (Level 0, permanently, per §8), `verify_whatsapp_number` (this one is `kind: "read"` — a verification check mutates only `Prospect.whatsappStatus`/`whatsappVerifiedAt`, the same "activity-log-shaped write" category `flag_stale_information` already earned Level-1-equivalent treatment for).
- **The Command Center** gains one more tile alongside its existing four (§8.4 of the base doc): "WhatsApp conversations awaiting response," computed the same way `overdueProspectCount` already is.
- **System State's `biggestBottleneck` heuristic** gains one more candidate check: a verified-WhatsApp, high-`opportunityScore` prospect with zero outreach — literally Winston's own §10 example, and the heuristic already has the exact shape (`if X < threshold → flag`) needed to add it as one more `if` branch, not a redesign.
- **The Morning Brief / Midday Nudge / End-of-Day Review** (Phase 3, `src/components/admin/DailyRhythm.tsx`) gain WhatsApp-aware content once the Orchestrator's `generate_daily_brief` tool (already real, already wired to the Morning Brief) has WhatsApp data to draw on — no new UI surface, the existing one gets richer inputs.
- **Messaging-performance learning** (Winston's §12) is explicitly **not** built in this phase — it needs weeks of real `WhatsAppSend`/response-outcome data to have anything to learn from, the exact same "needs weeks of data first" reasoning the base doc's own §9 already used to defer procrastination-pattern detection. Flagged as the natural Phase 5, not scoped further here.

---

## 13. Hosting & infrastructure decision

This is the one area where DeployFleet's stack constraints force a real architectural decision Zuri never had to make the same way, since Zuri was never Vercel-only to begin with.

**The WhatsApp Communication Layer must run as a separate, always-on service — it cannot be a Vercel serverless function, full stop.** Baileys needs a persistent WebSocket connection to WhatsApp and local disk for session credential files; Vercel functions are stateless and time-limited by design. This isn't a preference, it's a hard constraint, and it's exactly why Zuri itself runs `services/whatsapp` as its own long-lived process rather than folding it into `apps/web`.

**Recommendation: a small, dedicated, always-on host (Railway, Fly.io, or an equivalent small VPS), running only DeployFleet's WhatsApp service — never sharing infrastructure with the DeployFleet Odoo demo server** (`199.192.23.46`, per that sibling project's own `DEPLOYMENT.md` and its explicit "inventory what's running before touching that box" rule). Keeping this on genuinely separate infrastructure means a WhatsApp-service incident can never become an incident on a server hosting someone else's live production/staging Odoo instances — the same isolation discipline the Odoo project already applies to itself, applied here in the other direction.

**Storage: Firestore, not a new Postgres instance — a deliberate, disclosed tradeoff.** Zuri's choice of Postgres+pgvector buys real semantic search over conversation history; DeployFleet doesn't need that at its actual scale (the base doc's own already-made §12 call: "no vector store... dozens to low hundreds of prospects, one human user"), and staying on Firestore keeps this phase's operational surface to "one more service that talks to Firestore over HTTP" rather than "a second database DeployFleet now has to back up, migrate, and reason about." If real usage ever proves this wrong, Postgres is a scoped later addition, not a Phase 4 requirement.

**Shared package vs. copy-adapt: copy-adapt now, matching Winston's own "concrete porting plan" brief's conclusion.** Extracting a genuine shared `whatsapp-engine` npm package both Zuri and DeployFleet depend on is real, valuable future work — but doing it *before* DeployFleet has its own working, battle-tested version would mean designing an abstraction around a second consumer that doesn't exist yet, the same premature-abstraction trap this project's own stated engineering values explicitly warn against. Copy the transport/session-manager code into a new `deployfleet-whatsapp-service` (or similar) repo/directory now; revisit extraction once DeployFleet's own version has run in production for a while and the *real* shared surface (not the guessed one) is visible.

**Dedicated number, not Winston's personal line.** A WhatsApp Business number used only for DeployFleet outreach, separate from any Zuri-connected number — isolates ban/restriction risk to this one product's automation rather than risking Winston's own personal WhatsApp or Zuri's own connected account. Flagged as Winston's own decision to make (a real number has to be acquired), but the reasoning strongly favors dedicated over shared.

---

## 14. Phased rollout

Numbered `WA-0` through `WA-4` to keep them clearly distinct from the base doc's Phase 0–3 numbering, since this whole document *is* "Phase 4" at the outer level.

```
WA-0 — Gateway skeleton
  Port transport/types.ts + baileys.ts + session-manager.ts (single-session,
  single-user — no multi-tenant Map)
  New service, hosted per §13, talking to DeployFleet's Firestore via the
  Admin SDK directly (simplest — no third API layer needed between the WA
  service and Firestore, unlike Zuri's own services/api indirection)
  Own abstraction surface: sendMessage(), checkAvailability(), onMessage(),
  getConversation(), markRead(), getContact()
  Admin UI: connect / QR / status, mirroring Zuri's own reconnect-modal
  pattern for the UX, not the code

WA-1 — Number intelligence + prospect UI
  checkAvailability() wired to real prospect phones (§6)
  Prospect page gains WhatsApp status / last-verified / recommended-channel
  ProspectContact (§5.2) for multi-number prospects

WA-2 — Inbound as CRM activity
  Receive → identify prospect/conversation → store (§5.3)
  WHATSAPP_ANALYSIS_SYSTEM_PROMPT extraction (§7), reusing the AI Inbox's
  review-then-apply UI, not a new one
  Buying-signal → opportunityScore wiring (§10), live from day one (§2.2's
  lead-scoring lesson)

WA-3 — Controlled outbound (Copilot mode only, per §8 — the only mode this
        entire document scopes)
  Draft opening messages from a prospect's existing AI brief
  Every send is a proposal card, Winston approves, every time
  Daily cap, per-prospect cooldown, opt-out enforcement (§11) live from the
  very first send this phase ever makes — not added after

WA-4 — Orchestrator + Command Center integration (§12)
  Three new Orchestrator tools
  Command Center tile, System State bottleneck check
  Daily Rhythm content enrichment
```

**Explicitly out of scope for all of WA-0 through WA-4, deferred to a real Phase 5 once weeks of real data exist:** Supervised Autonomy (any auto-send, even for the narrowest reply class), Autonomous mode, messaging-performance learning/feedback loops (§12), and procrastination-pattern-style learning from WhatsApp-specific behavior.

---

## 15. Open questions & risks — resolved

Per Winston's explicit instruction ("for any open questions, implement your recommendations"), every question this section originally left open now carries a real decision, made and built against in the same session. Matching this project's own standing discipline, each resolution states its reasoning rather than just its answer:

- **`WhatsAppConversation.state` vs. `Prospect.stage` reconciliation — resolved: purely observational, no automatic write.** `WhatsAppConversation.state` never writes `Prospect.stage`. The two are related but not identical (§9's own example — `interested` while the pipeline stage hasn't advanced pending a second stakeholder — is real), and an automatic write risks silently overriding a stage Winston set deliberately. The conversation state is visible on the Prospect page and feeds the Command Center/System State as its own signal; advancing `Prospect.stage` itself stays exactly the same Winston-or-Orchestrator-proposal path it already was before this phase.
- **Hosting choice — resolved: Railway, host-agnostic build.** Railway is the concrete recommendation (simplest Docker-based deploy, persistent disk for Baileys' auth-state files, no cold starts) — but WA-0's gateway service (`whatsapp-service/`) is written host-agnostically: a plain Node process reading its config from environment variables and a `Dockerfile` with no Railway-specific API calls, so Fly.io or a small VPS work with zero code changes if Winston prefers. This is a recommendation for Winston to action (an account to create, a deploy to run), not something buildable from inside this repo.
- **Dedicated WhatsApp Business number — resolved: confirmed as Winston's own external step, documented, not blocking.** This cannot be provisioned by this codebase or this session — flagged in the gateway service's own README as the first manual step before `WHATSAPP_ENABLED` can ever be true in production. The gateway service and every DeployFleet-side integration are built and verified without one; `checkAvailability`/`sendText` simply return "gateway not connected" until a real number is linked via QR/pairing code, the same graceful-degradation pattern `isEmailJsConfigured()` already established for EmailJS.
- **`checkAvailability()` rate-limit safety — resolved: on-demand only, never batch.** No bulk/background verification job exists anywhere in this build — `checkAvailability()` is only ever called synchronously, once, immediately before a specific send or from the Prospect page's own "Verify" button, matching Winston's own 30-day freshness window (§6) without ever polling a list. If real volume later proves this too conservative, a bounded background job is a scoped future addition — not built speculatively here.
- **This document, like the base doc before it, has zero live-provider/live-WhatsApp verification behind any of it — still true, disclosed again here rather than silently dropped.** Every claim about Baileys/Zuri behavior traces to source code actually read (§2.2); the gateway service built in WA-0 is verified by `tsc`/`npm run build` against real `@whiskeysockets/baileys` types, never by an actual QR scan or live send, since this dev environment has no phone to scan a QR code with and no WhatsApp account to test against. This is the same "implemented to the documented API shape, not live-verified" caveat already carried through this project's DeepSeek/Gemini/EmailJS integrations.
- **Flat vs. nested Firestore collections — resolved: flat**, matching every other phase's own precedent (`Fact`, `Task`, `Decision` are all flat, filtered by `prospectId`). `whatsappMessages`/`whatsappConversations` follow the same shape. Worth a final look once real message volume is observed (a very chatty prospect could make `whatsappMessages` the single largest collection in the system) — not a blocker for this build.

**What "implement all phases in a single session" means given this environment's real constraints, stated plainly before the phase-by-phase build log below:** every phase's code (WA-0 through WA-4) is built and internally verified (`tsc`, `npm run build`, existing test suite) in this session. Two things remain structurally impossible from inside this sandboxed dev environment and stay manual steps for Winston after this session's commits land: **(1)** establishing a live Baileys↔WhatsApp connection, which requires a real phone to scan a QR code or enter a pairing code, and **(2)** actually deploying the new gateway service to live hosting infrastructure, since no hosting-provider credentials exist here. Every DeployFleet-side feature (verification, send, inbound analysis) is built to degrade gracefully — exactly like `isEmailJsConfigured()` already does for EmailJS — when no gateway is connected, rather than assuming one is.

---

## 16. Phased rollout plan (summary, matching the base doc's own §11 format)

```
WA-0 (gateway skeleton — separate service, ported transport/session layer)
  WhatsAppTransport port (§4)
  Session manager port, single-session (§4)
  Own abstraction: sendMessage/checkAvailability/onMessage/getConversation/markRead/getContact
  Connect/QR/status admin UI

WA-1 (number intelligence)
  checkAvailability() wired to Prospect.whatsappStatus/whatsappVerifiedAt/whatsappJid (§6)
  ProspectContact for multi-number prospects (§5.2)
  Prospect page WhatsApp section

WA-2 (inbound as CRM activity)
  WhatsAppConversation/WhatsAppMessage/WhatsAppMessageAnalysis (§5.3)
  WHATSAPP_ANALYSIS_SYSTEM_PROMPT extraction, review-then-apply via the AI Inbox's own UI (§7)
  Buying-signal → Prospect.opportunityScore (§10)

WA-3 (controlled outbound — Copilot mode only)
  WhatsAppSend + daily cap + cooldown + opt-out (§5.4, §11)
  Draft-and-propose send flow, Level 0 permanently for first contact (§8)

WA-4 (AI Marketing OS integration)
  3 new Orchestrator tools (§12)
  Command Center tile + System State bottleneck check
  Daily Rhythm content enrichment

Phase 5 (not scoped in this document — explicitly deferred)
  Supervised Autonomy for a narrow, proven reply class
  Messaging-performance learning/feedback loop (§12)
  Any reconciliation between this and Zuri toward a genuinely shared package (§13)
```
