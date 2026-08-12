# Email & WhatsApp Command Center — the channel-workspace architecture

**Status: planning document for the "best, with all features" ask — some pieces already shipped this session (marked ✅ below), the rest not yet built.** Written the same way every prior large-vision item in this project got a document first (`docs/ai-marketing-os-architecture.md`, `docs/whatsapp-intelligence-architecture.md`, `docs/revenue-os-architecture.md`) — grounded in what actually exists, not the vision restated as if it were already true.

**This doc is deliberately the deeper design for two bullet points `docs/revenue-os-architecture.md` already scoped at a higher level — §5.12 (AI-assisted messaging, tone variants) and §5.13 (conversation ingestion).** Nothing here contradicts that doc; it goes one level deeper specifically for Email and WhatsApp, per Winston's explicit ask to plan "a very helpful email section... the best with all features" and "the same for WhatsApp," reusing rather than re-deriving what Revenue OS already committed to.

---

## 0. Where this comes from

Two real production bugs surfaced the underlying gap this document addresses:

1. **"EmailJS couldn't send this: The recipients address is empty"** — root-caused this session (see `docs/email-templates.md` §4): not a code bug, an EmailJS dashboard configuration gap (the templates' own Settings → "To Email" field was never set to `{{to_email}}`). Fixed in docs; Winston still needs to apply it in the EmailJS dashboard for each template.
2. **"Verify number" / "still shows Connect"** — root-caused a real diagnosability bug this session: `gatewayClient.ts`'s `gatewayFetch()` discarded the WhatsApp gateway's own error `reason` on any non-2xx response and replaced it with a generic `http_503`, so a genuine `not_connected` (no session linked yet) and a network timeout rendered identically as "Couldn't complete this action." Fixed this session (see §1.2 below) — but the underlying question of *whether the gateway session is actually still live on the server* couldn't be answered from here and needs Winston to check the demo server directly (see the reply alongside this document for the exact steps).

Both bugs share one root lesson, worth stating as a governing principle for everything below: **a channel that's silently failing must never look identical to a channel that's simply idle.** Every surface this document proposes carries that forward.

---

## 1. Current state — what actually exists today

### 1.1 Email — a single-shot send widget, not a channel workspace

`SendEmailPanel.tsx` (rendered once, on a prospect's Overview tab) is exactly what its name says: pick a template, click Send. As of this session it has three templates — Cold Outreach and Follow-up (fixed merge-tag copy) and **Custom** (✅ shipped this session: a fully editable subject/body, with AI Draft and AI Revise actions against `POST /api/admin/crm/email/draft`, mirroring the WhatsApp draft pattern). `EmailSend` (`crmTypes.ts`) is a real audit record — one row per attempt, `status: "sent" | "failed"`, cap-enforced server-side at 20/day.

**What doesn't exist, confirmed by reading `crmTypes.ts`/`crm.ts` before writing this doc, not assumed:**
- **No inbound email capture of any kind.** EmailJS is send-only — there's no receiving mailbox, no forwarding address, no IMAP/webhook integration anywhere in this codebase. A prospect's email *reply* has no automatic path into the system at all today.
- **No thread concept.** `EmailSend` rows aren't grouped or rendered as a conversation anywhere — the Prospect page's Timeline tab lists them chronologically alongside everything else, not as an email-shaped thread.
- **No channel-level workspace.** There is no "Email Center" — email only exists as a widget on each individual prospect's page. Compare to WhatsApp, which already has exactly this (§1.2).

### 1.2 WhatsApp — already most of the way to a real channel workspace

`WhatsAppInboxTab.tsx` (`/admin/whatsapp`) is a genuine two-pane channel workspace, not a widget: a filterable conversation list (All / Unread / Needs response) and a real bidirectional message thread — WhatsApp-style bubbles, day-of-week dividers, auto-scroll, live polling. `WhatsAppMessage.senderType` already distinguishes `prospect` / `winston` / `ai_draft`. `SendWhatsAppPanel.tsx` is a second, narrower surface on the Prospect page itself (Verify → AI draft → Send) — a real, deliberate duplication (quick action from the prospect record vs. the full inbox), not an oversight.

Inbound messages already run through `WHATSAPP_ANALYSIS_SYSTEM_PROMPT` (buying-signal extraction feeding `Prospect.opportunityScore` directly, no approval gate — see `docs/whatsapp-intelligence-architecture.md` §10), and `InboxSourceType` already has a dedicated `whatsapp_conversation` value, meaning a WhatsApp exchange can already be routed through the general AI Inbox extraction pipeline (facts/tasks/decisions) exactly like a pasted call transcript can.

**What's real but not yet surfaced**: none of that extracted intelligence (buying signals, facts, tasks, decisions) is shown *inline in the thread itself* — `WhatsAppInboxTab` renders messages only. Winston has to leave the inbox and go to the Prospect page's Intelligence/Timeline tabs to see what the system inferred from the conversation he's looking at.

### 1.3 The asymmetry this document has to resolve

WhatsApp already has a real channel workspace with live bidirectional history; Email has neither inbound capture nor a workspace at all. Building "the same for WhatsApp" and "the best email section" as if they start from the same place would be dishonest — the plan below is explicit about which parts are "build a new equivalent" (Email) versus "extend something real" (WhatsApp).

---

## 2. The governing design: one shared Channel Command Center shape, not two different UIs

Both channels converge on the same four pieces, so this isn't designed twice, inconsistently:

1. **A channel-level workspace** — list every prospect with activity on this channel, filterable by state/urgency. WhatsApp has this (`WhatsAppInboxTab`) ✅. Email needs a new equivalent, `EmailCenterTab` (§4.1).
2. **A per-prospect thread rendered as one unified timeline** — messages *and* the AI insights/tasks/decisions extracted from them, interleaved in time order, not two separate places to look. This is the direct answer to Winston's "communication and chats with AI assistants... must be easily viewable as a nice formatted chat view with our AI insights, tasks, decisions, etc built-in... our system lives on data." Detailed in §4.3.
3. **A composer with template/tone selection + AI draft/revise + visible "why AI wrote this."** Email has this now (Custom template, shipped this session). WhatsApp has AI draft but not tone variants yet (§4.4, reusing Revenue OS §5.12 verbatim rather than re-specifying it).
4. **Conversation ingestion** — the path for content that didn't arrive through this app's own send/receive pipeline (a reply forwarded by hand, a WhatsApp export) to become part of the thread. Already real and general-purpose (`InboxEntry` + the extraction pipeline) — §4.5 scopes it per-channel rather than building something new.

---

## 3. Data model — what's genuinely new vs. what's reused as-is

**Reused with zero schema changes:**
- `Fact` / `Task` / `Decision` already carry `relatedProspectId` — the inline-insight-cards-in-a-thread idea (§4.3) is a *read* pattern (fetch these three collections filtered to one prospect, merge with messages by timestamp), the same merged-read shape the Prospect page's own Timeline tab already uses today. No new collection needed for this.
- `InboxEntry` + `InboxSourceType` already generalize to any pasted conversation. Adding a value is the only schema change needed for email-reply ingestion (below).
- `EmailSend` already has everything needed to render outbound email history as chat-style bubbles (recipient, template, status, timestamp) — no new fields.

**One small, genuinely new addition:**

```ts
// Add to InboxSourceType (crmTypes.ts):
"email_reply"
```

A prospect's email reply — however it reaches Winston (forwarded, copy-pasted) — gets pasted into the AI Inbox tagged `email_reply` instead of `winston_direct`, runs through the *existing* extraction pipeline unchanged, and (new, small) also gets rendered inline in the Email Center's thread view as a left-aligned "reply" bubble, the same visual role `senderType: "prospect"` plays in the WhatsApp thread. This is the pragmatic answer to §1.3's asymmetry — it doesn't build real inbound-email infrastructure (see §6's open question), it extends a mechanism that already exists.

**No new entity is needed for "AI insights/tasks/decisions built into the chat view."** This was the temptation to avoid — a new `ThreadInsight` table would duplicate `Fact`/`Task`/`Decision`, which already have everything needed. The actual work is a read-side timeline merge, not a write-side schema change.

---

## 4. Subsystem plan

### 4.1 Email Center (`EmailCenterTab.tsx`, new — `/admin/email`)

Mirrors `WhatsAppInboxTab`'s own shell exactly (list + thread, same filter-chip pattern, same polling discipline) rather than inventing a different layout: every prospect with at least one `EmailSend` or `email_reply`-tagged `InboxEntry`, filterable (All / Sent today / Awaiting reply — the last one honestly computed as "sent, no `email_reply` InboxEntry since," not a real read-receipt, matching WhatsApp's own honest "no fake delivery ticks" precedent in `StatusTick`). Selecting a prospect opens their thread (§4.3). Added as a new top-level nav item alongside WhatsApp — see §6's open question on whether that's the right home for it.

### 4.2 WhatsApp Inbox — extended, not rebuilt

`WhatsAppInboxTab` keeps its existing shell. The only structural addition is the inline-insight timeline (§4.3) and, later, tone variants in the composer (§4.4). `SendWhatsAppPanel` (the Prospect-page quick-action) stays as-is — still the right surface for "verify + send one message without leaving the prospect record."

### 4.3 The unified chat timeline — the actual answer to "our system lives on data"

For both channels, the thread view becomes a single merged, time-ordered read: messages (WhatsApp) or sends/replies (Email), interleaved with **insight cards** — small, visually distinct (AI-violet-accented, matching this project's existing AI-content color convention, `docs/architecture` precedent aside — this codebase's own `AiBadge`-equivalent treatment) cards for:
- a `Fact` extracted from that conversation (key/value, confidence),
- a `Task` created from it (title, due date, status — tappable to mark done inline, not just a read view),
- a `Decision` referencing it as evidence.

Each insight card shows **which message it came from** (a thin visual link/highlight back to the triggering bubble) — this is the concrete shape of "why AI wrote this" for the insight layer, distinct from the composer's own "why AI wrote this" for drafted messages (§4.4). Read-only in v1 (editing a Fact/Task/Decision still happens on the Prospect page's Intelligence tab) — a fully inline edit surface is a real future enhancement, not required to satisfy "viewable... with AI insights, tasks, decisions... built in."

### 4.4 Tone-variant composer (WhatsApp) — reusing Revenue OS §5.12, not re-specifying it

Revenue OS §5.12 already scoped this precisely: extend `WHATSAPP_DRAFT_SYSTEM_PROMPT` with a tone parameter (shorter / more conversational / more professional / less salesy / follow-up / first-contact / objection-response / meeting-request / re-engagement) folded into the prompt, return a one-line "why AI wrote this" alongside the draft in the same JSON response. Email's Custom template already has the equivalent shape today (AI Draft + free-text Revise instruction) — worth reconciling the two into one shared pattern once this is built, rather than shipping two different tone-selection UIs (a fixed tone-chip list for WhatsApp vs. free-text instruction for Email). Recommendation, not yet decided: keep WhatsApp's chip list (message tone matters more when there's no room to explain), keep Email's free-text (a subject+body edit benefits from an open instruction, e.g. "lead with the ROI angle") — different enough interactions that forcing one shape onto both would be worse, not better.

### 4.5 Conversation ingestion, scoped per channel

Already general-purpose (§1.2/§3). The only per-channel work: the Email Center's paste-box (mirroring `InboxPasteBox.tsx`'s existing pattern) defaults to `sourceType: "email_reply"` and `relatedProspectId` pre-filled from context, the same way the Prospect page's own paste box already pre-fills `relatedProspectId` today. No new extraction logic — `INBOX_EXTRACTION_SYSTEM_PROMPT` already handles arbitrary pasted text.

---

## 5. Phased rollout

```
EW-0 — Diagnosability (✅ shipped this session)
  gatewayFetch() surfaces the gateway's real error reason instead of a
  generic http_503; WhatsAppConnectPanel/SendWhatsAppPanel distinguish
  "gateway unreachable" from "gateway says disconnected"
  Email Custom template: editable subject/body + AI draft/revise
  docs/email-templates.md: the missing "To Email" dashboard step

EW-1 — Email Center
  EmailCenterTab.tsx + /admin/email route + nav entry
  email_reply InboxSourceType + Email Center paste box

EW-2 — Unified chat timeline (both channels)
  Merged Fact/Task/Decision-in-thread read, insight cards, source-message link
  Applied to WhatsApp Inbox first (richer history to prove the pattern
  against), then Email Center

EW-3 — Tone-variant composer
  WhatsApp: tone chips + "why AI wrote this" in the draft response
  Reconcile with Email's existing free-text Revise per §4.4's recommendation

EW-4 — Real inbound email (only if Winston confirms it's worth it — §6)
  A receiving/forwarding address or webhook-based inbound parser,
  replacing the manual-paste email_reply flow with automatic capture
```

EW-0 is done. EW-1 through EW-3 are all extensions of real, already-working mechanisms — no new infrastructure, no new external accounts. EW-4 is the one item that would need a real new decision (see below).

---

## 6. Open questions

- **Is manual paste-in enough for email replies, or does Winston want real inbound-email capture (EW-4)?** The honest tradeoff: manual paste (§4.5) works today with zero new infrastructure, but depends on Winston remembering to paste every reply in. Real inbound capture (a dedicated receiving address, forwarding rule, or a service like Postmark/SendGrid's inbound parse webhook) is a genuinely new integration — a new account/webhook, not an extension of EmailJS (which has no inbound capability at all) — and should only be scoped once EW-1 through EW-3 are live and the manual-paste friction is a felt problem, not a hypothetical one.
- **Does Email Center become a new top-level nav item, or fold into an existing one?** WhatsApp got its own top-level entry because it's a genuinely separate real-time surface; Email today is lower-volume (20/day cap) and thread-light (no live inbound). Worth Winston's call before building §4.1.
- **Should the WhatsApp tone-variant chip list and Email's free-text Revise instruction be reconciled into one shared component**, or is the difference in §4.4 the right call? Flagged, not decided.
