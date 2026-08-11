# EmailJS setup — env vars and template content

Resolves the open item from `docs/ai-marketing-os-architecture.md` §12:
outbound automation is email-only, via [EmailJS](https://www.emailjs.com/)
(client-side sending, no new backend email service), capped at 20/day.

**Scope of this doc:** the env var names to add in Vercel and the actual
template copy to paste into the EmailJS dashboard. It does **not** yet
include the `emailSends` collection / 20/day cap enforcement / `POST
/api/admin/crm/email/send` route the architecture doc sketches — that's
still open, natural home is alongside the Outreach (Campaign) entity,
build it when you're ready to actually send from the app rather than
just configure the account.

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

**`{{followup_context}}`** is meant to be filled per-send with a short
phrase (e.g. "our call last Tuesday" or "the demo you started") — either
typed by Winston at send time, or pulled from the prospect's
`lastInteractionSummary` once the send feature is built.

## 3. Env vars to add in Vercel

Project Settings → Environment Variables. All four are safe to expose
client-side — EmailJS's own security model is origin-restriction in your
account dashboard (**Email Services** → your service → **Allowed
origins**, add your production domain), not keeping these values secret,
the same non-secret-client-config pattern this project already uses for
Firebase (`src/lib/firebase.ts`) and Fingerprint's public key.

```bash
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH=
NEXT_PUBLIC_EMAILJS_TEMPLATE_FOLLOWUP=
```

Added to `.env.example` with the same comments as above, for consistency
with every other integration in this repo.

## 4. Still open (not built yet)

- The `emailSends` Firestore collection (recipient, template, campaignId,
  sentAt, status) and the per-day counter enforcing the 20/day cap —
  **must be enforced server-side** even though EmailJS itself sends
  client-side, per the architecture doc §12's own warning (never trust a
  client-only limit).
- `POST /api/admin/crm/email/send` — the route that would actually check
  the day's count, call EmailJS's SDK, and log the send.
- UI to trigger a send from a prospect's page or the Outreach (Campaign)
  workspace.

Ask for this explicitly when you want the actual send button built —
this doc only gets the account/template/env-var side ready for it.
