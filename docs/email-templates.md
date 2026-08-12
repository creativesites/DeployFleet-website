# EmailJS setup — env vars, the template, and the send feature

Resolves the open item from `docs/ai-marketing-os-architecture.md` §12:
outbound automation is email-only, via [EmailJS](https://www.emailjs.com/),
capped at 20/day.

**The send button is built**, and now built around one unified, always-
editable composer. Every prospect page (`/admin/prospects/[id]`, Overview
tab) has a `SendEmailPanel` — pick a starting point (Cold Outreach,
Follow-up, or Custom), edit the subject and body freely (every preset is
editable now, not just Custom), preview exactly what will be sent, then
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

## A real architecture change: three EmailJS templates collapsed into one

**This app originally used three separate EmailJS templates** (Cold
Outreach, Follow-up, Custom), each with its own baked-in copy in the
EmailJS dashboard and only a handful of merge-tag fields editable
per-send (e.g. `{{followup_context}}`). Winston asked to be able to edit
the actual body content of every email, not just Custom's — and once
every send needs an editable subject/body pair anyway, keeping three
separate EmailJS templates around stopped making sense: it just meant
three places to apply the "To Email" fix below instead of one, for zero
remaining benefit.

**Now there is exactly one EmailJS template, a thin `{{subject}}`/`{{body}}`
pass-through** (see step 2). "Cold Outreach" and "Follow-up" are no
longer separate EmailJS templates — they're **deterministic starting
text**, generated server-side by `src/lib/email/presets.ts` (the exact
copy this doc used to embed directly in the EmailJS dashboard, now
copied there instead — this file is the source of truth for that copy,
not the dashboard) and returned via `POST /api/admin/crm/email/preset`
to fill `SendEmailPanel`'s editable fields. "Custom" starts blank. From
that point on, every preset behaves identically: fully editable, with the
same AI Draft/Revise actions on top (`POST /api/admin/crm/email/draft`).

**If you already created the old three-template setup**: you only need
to keep (or create) one template now — see step 2. The old
`NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH`/`_FOLLOWUP`/`_CUSTOM` env
vars are no longer read by this app at all; the two old dashboard
templates with baked-in copy can be deleted from EmailJS (not required,
just unused).

## 1. Create your EmailJS account + service

1. Sign up at [emailjs.com](https://www.emailjs.com/).
2. **Email Services** → add a service (Gmail, Outlook, or SMTP — whichever
   inbox Winston sends DeployFleet outreach from). Note the **Service ID**
   it generates (e.g. `service_abc1234`).
3. **Account** → **General** → copy your **Public Key** (this used to be
   called "User ID" in older EmailJS docs — same value).

## 2. Create the one template

**Email Templates** → **Create New Template.** This is a thin
pass-through — it never contains prewritten copy, since every email's
actual subject/body now comes from `SendEmailPanel` at send time.

**Subject:**
```
{{subject}}
```

**Content:**
```
{{body}}
```

**Critical step, easy to miss, and the root cause of a real bug hit in
production ("EmailJS couldn't send this: The recipients address is
empty")**: referencing `{{to_email}}` anywhere in the Content is *not*
enough — EmailJS only treats a template variable as the actual envelope
recipient if it's also set in that template's own **Settings** tab. Open
this template → **Settings** tab → **To Email** field → enter
`{{to_email}}` → **Save**. This app has always sent a correct `to_email`
value in every request; the failure is purely this one dashboard field
being left blank when the template is first created — worth confirming
with EmailJS's own **"Test It"** button in the template editor before
retrying from this app.

Copy the resulting **Template ID** (e.g. `template_xyz789`) — you'll need
it for `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` below.

**`{{subject}}`/`{{body}}` are populated by `POST /api/admin/crm/email/send`**
from whatever's in `SendEmailPanel`'s fields at send time — deterministic
preset text (`POST .../email/preset`, no AI), AI-drafted (`POST
.../email/draft`, no `instruction`), AI-revised (same route, with an
`instruction` like "shorter and more casual"), or typed by hand — always
sent verbatim, always Level 0 (Winston reviews and can edit the exact
text before clicking Send; nothing sends itself).

## 3. Env vars to add in Vercel

Project Settings → Environment Variables.

```bash
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
```

The three above are safe to expose client-side — EmailJS's own security
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

Default to "Winston" / "DeployFleet" if unset. These are baked directly
into the Cold Outreach/Follow-up preset text's sign-off by
`src/lib/email/presets.ts` (editable from there, like everything else,
before sending) rather than resolved as EmailJS merge tags — a
consequence of moving to one pass-through template.

All of the above are in `.env.example` with the same comments, for
consistency with every other integration in this repo.

## 4. Still open

- **The exact real bug that motivated this doc's "To Email" step**: Winston
  hit `EmailJS couldn't send this: The recipients address is empty` in
  production, on the original three-template setup, and reported it was
  still happening after the first documentation fix — worth confirming
  the "To Email" field was actually saved (not just referenced in
  Content) for whichever template is currently configured, using
  EmailJS's own "Test It" button to verify independently of this app.
- Plain-text only — no rich text/HTML composer. The template's `{{body}}`
  merge tag renders whatever plain text was sent, newlines included, but
  no bold/links/images. Worth revisiting only if Winston's actual usage
  shows this is a real limitation, not preemptively.
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

## 5. "Copy briefing" — getting the team's input into a draft

Winston's AI teammates (Charity/AI SDR, Bupe/AI Sales Coach, etc. — see
`/admin/team`) are personas he chats with in an external tool, not live
agents inside this app (see `docs/ai-marketing-os-architecture.md`'s own
framing of `AiEmployee`). `SendEmailPanel`'s composer has a "Get input
from the team" section: pick a teammate, click **Copy briefing for
[name]**, and a ready-to-paste text block (that teammate's role/mission/
instructions plus everything this app knows about the prospect, via the
same `compileProspectContext()` every AI call in this app already uses)
goes on the clipboard — paste it into the external chat, get their
answer, then bring it back into this prospect's Employee Intelligence tab
via the normal paste-and-review flow. No AI call happens in the copy
step itself — it's plain, deterministic text assembly
(`src/lib/ai/briefing.ts`, `POST /api/admin/crm/team/briefing`).

The Employee Intelligence tab's paste box also now shows a **History**
disclosure — every past entry pasted for that employee/prospect pair,
not just the one currently being reviewed, so a "conversation" with a
teammate about a given prospect is actually visible as a thread over
time rather than disappearing the moment it's applied.
