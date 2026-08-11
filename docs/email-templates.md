# EmailJS setup — env vars, templates, and the send feature

Resolves the open item from `docs/ai-marketing-os-architecture.md` §12:
outbound automation is email-only, via [EmailJS](https://www.emailjs.com/),
capped at 20/day.

**The send button is built.** Every prospect page (`/admin/prospects/[id]`,
Overview tab) has a `SendEmailPanel` — pick Cold Outreach or Follow-up,
send. `POST /api/admin/crm/email/send` enforces the cap, sends, and logs
an `Interaction` + `AuditEvent` on success. The Today tab also links each
prospect with an email on file straight to their page's send panel.

**One deliberate deviation from this doc's own earlier wording and from
the architecture doc's literal phrasing** ("a route wrapping EmailJS's
client SDK"): the actual send call happens **server-side**, via EmailJS's
plain REST API (`https://api.emailjs.com/api/v1.0/email/send`), not
their browser SDK. Reasoning: EmailJS's REST endpoint is just an HTTP
POST — nothing about it requires a browser — and doing the send
server-side is what makes the 20/day cap a *real* limit. If the browser
held the public key and made the EmailJS call itself, a modified client
could call EmailJS directly and skip this app's cap check entirely; by
keeping "check the cap → send → log" inside one server request
(`src/app/api/admin/crm/email/send/route.ts`, using
`src/lib/email/emailjs.ts`), there's no gap to exploit. This does need
one more secret EmailJS provides for exactly this case — see step 3.

## 1. Create your EmailJS account + service

1. Sign up at [emailjs.com](https://www.emailjs.com/).
2. **Email Services** → add a service (Gmail, Outlook, or SMTP — whichever
   inbox Winston sends DeployFleet outreach from). Note the **Service ID**
   it generates (e.g. `service_abc1234`).
3. **Account** → **General** → copy your **Public Key** (this used to be
   called "User ID" in older EmailJS docs — same value).

## 2. Create the two templates below

**Email Templates** → **Create New Template**, once per template. EmailJS
templates use `{{variable}}` merge-tag syntax in both the Subject and
Content fields — paste the content exactly as written below (adjust
signature details to match Winston's real contact info before sending
anything for real). Each template gets its own **Template ID**
(e.g. `template_xyz789`) — copy it, you'll need it for the matching env
var below.

### Template 1 — Cold Outreach (`NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH`)

For a prospect who hasn't been contacted yet (outbound cold list, stage 1
"Researched"). Keep it short — this is a first touch, not a pitch deck.

**Subject:**
```
{{company_name}} + DeployFleet — a quick question about your fleet
```

**Content:**
```
Hi {{to_name}},

I'm {{from_name}} with DeployFleet — we build fleet management software
for trucking and logistics companies here in Zambia.

I came across {{company_name}} and had a quick question: how are you
currently tracking fuel costs, maintenance schedules, and driver pay
across your fleet? Most operators we talk to are still doing this across
spreadsheets, WhatsApp, and paper logs — which works, until it doesn't.

DeployFleet puts dispatch, fuel, maintenance, compliance documents, and
billing in one place, with a live demo you can try without signing up:
{{demo_link}}

Worth a quick 15-minute call to see if it's a fit for how {{company_name}}
runs today?

{{from_name}}
{{from_role}}
DeployFleet
{{reply_to}}
```

### Template 2 — Follow-up (`NEXT_PUBLIC_EMAILJS_TEMPLATE_FOLLOWUP`)

For a prospect already in the pipeline (had at least one prior contact —
stage 3+). References the prior conversation instead of introducing the
company again.

**Subject:**
```
Following up — {{company_name}} and DeployFleet
```

**Content:**
```
Hi {{to_name}},

Following up on {{followup_context}} — wanted to check in and see if
there's anything I can answer or send over that would help you make a
call on DeployFleet for {{company_name}}.

If now isn't the right time, no problem at all — just let me know and
I'll check back later rather than keep following up.

If you'd like another look at the live demo, it's still here:
{{demo_link}}

{{from_name}}
{{from_role}}
DeployFleet
{{reply_to}}
```

**`{{followup_context}}`** is filled per-send with a short phrase (e.g.
"our call last Tuesday" or "the demo you started") — `SendEmailPanel`
prefills it from the prospect's `lastInteractionSummary` when one
exists, editable before sending, and falls back to the generic "our
last conversation" server-side if left blank.

## 3. Env vars to add in Vercel

Project Settings → Environment Variables.

```bash
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH=
NEXT_PUBLIC_EMAILJS_TEMPLATE_FOLLOWUP=
```

The four above are safe to expose client-side — EmailJS's own security
model is origin-restriction in your account dashboard (**Email
Services** → your service → **Allowed origins**, add your production
domain), not keeping these values secret, the same non-secret-client-
config pattern this project already uses for Firebase
(`src/lib/firebase.ts`) and Fingerprint's public key. They're still read
server-side too (the send route lives on the server, see above) — kept
as `NEXT_PUBLIC_` names for continuity with what this doc originally
documented, not because the client needs them anymore.

**One more, and this one is a real secret — never `NEXT_PUBLIC_`-prefix
it:**

```bash
EMAILJS_PRIVATE_KEY=
```

Find it at **Account** → **Security** → **Private Key**. EmailJS
requires this (as an `accessToken` in the API request) to accept a send
call that isn't coming from a browser it recognizes — without it, every
send from this app's server-side route fails with
`emailjs_not_configured`.

**Optional — how outbound emails are signed:**

```bash
EMAIL_SENDER_NAME=
EMAIL_SENDER_ROLE=
EMAIL_REPLY_TO=
```

Default to "Winston" / "DeployFleet" if unset. Set `EMAIL_REPLY_TO` to a
real inbox — it fills the `{{reply_to}}` merge tag both templates above
use.

All of the above are in `.env.example` with the same comments, for
consistency with every other integration in this repo.

## 4. Still open

- **The 20/day cap resets at UTC midnight**, not Zambia local midnight
  (`countEmailSendsToday()` in `src/lib/crm.ts` compares against
  `new Date().toISOString().slice(0, 10)`) — a ~2-hour offset from CAT,
  not worth timezone-aware date math for a personal-use daily cap, but
  worth knowing if the count resets earlier/later than expected.
- No campaign-level send reporting UI yet — `EmailSend` records do carry
  `campaignId` (copied from the prospect's own `campaignId` at send
  time), but nothing in the Outreach workspace reads it yet.
- No unsubscribe/opt-out mechanism — this is a personal cold-outreach
  tool at low volume (20/day), not a marketing-automation platform; add
  one before volume or audience changes that calculus.
