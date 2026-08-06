# DeployFleet Website

The public marketing site for DeployFleet — "Mission Control for African
Trucking." Next.js (App Router) + Tailwind CSS v4, deployed on Vercel.

This is a standalone project, deliberately separate from the
[DeployFleet Odoo application repo](https://github.com/creativesites/DeployFleet).
It never depends on that repo and should never become a dependency of it —
see that repo's `CLAUDE.md` §5, "Marketing website — separate from Odoo
entirely."

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS v4 (CSS-first config via `@theme` in `src/app/globals.css` —
  no `tailwind.config.js`)
- Deployed on Vercel

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build + type check
npm run lint    # ESLint
npm run test    # vitest — calculator engine unit tests
```

## Brand tokens

All brand colors, spacing, and the CTA gradient live as CSS custom
properties at the top of `src/app/globals.css` (`--df-*`), mapped into
Tailwind's `@theme` block so they're usable as ordinary utility classes
(`text-navy`, `bg-canvas`, `border-teal`, `text-gradient-brand`, etc.).
**Never hardcode a brand hex value in a component** — add or reference a
token instead.

| Token | Value | Use |
|---|---|---|
| `--df-navy` | `#0A1128` | Headlines, body text |
| `--df-cyan` → `--df-teal` | `#00D2FF` → `#0B93D3` | Brand gradient — CTAs, accents, `.text-gradient-brand` |
| `--df-canvas` | `#F8FAFC` | Page background |
| `--df-card` | `#FFFFFF` | Card/surface background |
| `--df-border` | `#E2E8F0` | Dividers, card borders |
| `--df-ai-violet` | `#7C3AED` | **Reserved exclusively for AI-related content** (Copilot sections), mirroring the same convention used in the DeployFleet product itself. Never used decoratively. |

Logo assets are in `public/brand/` (`logo-lockup-light.png` for light
backgrounds, `logo-lockup-dark.jpg` for dark). Both are raster exports with
a baked-in background — a transparent PNG/SVG export would clean up the
navbar/footer rendering; not yet supplied.

`public/brand/hero-video.mp4` (autoplay/muted/loop) and
`public/brand/hero-promo.png` (its poster, and the site's Open Graph/Twitter
share image) are the designed hero asset — not a real product screenshot,
a composed promo graphic. Its baked-in copy says "Built for Zambian
trucking," which is fine as supporting visual proof but is a country-first
frame the on-page copy deliberately avoids (see Messaging guardrails) — if
that's ever regenerated, keep the on-page/visual framing consistent.

## Content status

The full site structure (nav, footer, homepage, and all `/product/*`,
`/solutions`, `/pricing`, `/about`, `/resources`, `/demo`, `/contact`
routes) is built and passes `next build`.

**Screenshots** — like the hero asset, these are designed mockups of the
product's screens (consistent branding, realistic demo data), not raw
screen captures of the running app — worth knowing since they're a step
more polished/idealized than what today's live demo actually looks like.
Real captures can replace them 1:1 later with no layout changes needed.
They now cover most of the site: `public/screenshots/` holds
`mission-control.png`, `mission-control-mobile.mp4`, `dispatch-board.png`,
`dispatch-assign.png`, `fleet-command-center-list.png`, `vehicle-360.png`,
`maintenance-center.png`, `compliance-center.png`,
`financial-intelligence.png`, `copilot-console.jpg`, `ai-predictions.jpg`,
and `launcher.jpg`, wired into the homepage sections and product pages via
the `Screenshot` component. `financial-intelligence.png` is currently
reused on the Billing page as an approximate fit (it's Financial
Intelligence, not literally the Invoice Ledger the label used to
describe) — swap for a dedicated shot when one exists. `/product/
ai-copilot` now carries two real screenshots: the Copilot Console (usage
& cost dashboard, agent catalog) in the original placeholder slot, plus a
second "Real predictions, not a mockup" section further down showing the
Maintenance Agent's actual AI Predictions screen — added because the
screenshot didn't fit the existing "Copilot Rail chat" slot (it's a
different screen entirely) but was too good a real-data visual not to use
somewhere. **Still a labeled placeholder** (`ScreenshotPlaceholder`,
label text doubles as the shot needed):
- Homepage AI Copilot section — still needs a Copilot Rail chat
  screenshot (with a tool-lookup line visible) — waiting on the Copilot
  Rail's current round of updates to finish before that one's taken.

The Hero renders a single landscape `hero-video.mp4` (1280×720) at every
breakpoint (`object-cover` inside a responsive `max-w-6xl` frame, not a
separate portrait clip) — capped to loop at 8 seconds via a small
`timeupdate` listener (`LOOP_SECONDS` in `Hero.tsx`) since the native
`loop` attribute only replays a clip's full length. `mission-control-
mobile.mp4` (720×1280, true portrait) is a genuinely different asset — the
real Mission Control screen recorded on a phone — and lives in
`SolutionSection` instead: on mobile it replaces `mission-control.png`
with this video (loops natively, no 8s cap — that cap is specific to the
Hero's own pacing), while `sm` and up still show the static screenshot.
This was a fix, not a new feature: the video had originally been wired
into the Hero by mistake (see `git log -- public/screenshots/mission-
control-mobile.mp4` for the rename) — its own content is Mission Control,
not a hero shot, and it's now used in the section that's actually about
Mission Control.

- **WhatsApp number** — `WHATSAPP_NUMBER` in `src/lib/nav.ts` is set to
  `260979046745`, sourced from the number printed on the hero promo
  graphic. Not independently verified — confirm it's the right, current
  number before launch.
- **Pricing** — no fixed numbers exist yet (open question in the product's
  own architecture docs). The pricing page intentionally shows tiers by
  what's included, not by price, funneling to a conversation instead.
- **Lead capture** — both forms (`DemoForm` on `/contact`, the homepage
  `CtaSection`) submit by opening a pre-filled WhatsApp chat client-side. No
  backend/CRM integration exists yet; that's a deliberate MVP choice
  (WhatsApp is the channel this audience actually uses), not an oversight.

## Planned: gated demo access

**Current behavior:** every "Book a Demo" / "Launch the Live Demo" CTA
(`LIVE_DEMO_URL` in `src/lib/nav.ts`) links straight to the shared live
demo instance (`http://199.192.23.46:4169/odoo`), which has one-click
login for the Owner/Dispatcher/Driver views. No form, no gate — this is a
deliberate, explicit choice for now, not a gap. a marketing decision 

**Planned, once a lead-capture backend exists:** collect the visitor's
name/company/phone *first* (the existing `/demo` role cards and copy stay,
just gated behind a short form), store the lead, *then* redirect to the
live demo — or to a personalized one-click login link, if the product ever
supports per-prospect demo instances the way `deployfleet_demo_zm`'s
generation pattern already suggests is possible. Implementing this is a
backend/CRM decision (where leads get stored, what "personalized instance"
means operationally), not just a frontend change — flagged here so it
isn't rediscovered from scratch later.

## Intelligence Hub (`/intelligence-hub`)

The free, no-sign-up calculator suite — full architecture and phasing in
the [Intelligence Hub plan](https://claude.ai/code/artifact/f1e7dac5-66a5-4a1d-81bf-2a3ae9033e82).
Governing rule: every calculator is a deterministic **Layer 1** engine
(`src/lib/calculators/*.ts` — pure functions, no network calls, unit
tested) with an **optional Layer 2** AI enhancement on top, never the
reverse. Layer 2 (DeepSeek → Gemini provider router, explanations,
recommendations) is Phase B — now built, see below.

**Locked decisions** (all six — calculator selection, $20/month AI spend
ceiling, Firebase+Clerk as the Phase E/F accounts stack, the benchmark
data workflow, Google Maps Distance API authorization for Phase B, and
"Intelligence Hub" over "Calculators" as the nav name) are recorded in the
plan doc §11, not just in chat history — check there before re-deciding
anything already settled.

**Phase A is complete — all 3 calculators shipped, engine-only, no AI:**
- **Cost Per Kilometre** (`/intelligence-hub/cost-per-km`) — fuel, fixed
  costs, tyres/maintenance, driver wages, tolls, broken down per km with
  an annual total. `costPerKm.ts` (7 tests).
- **Trip Profitability** (`/intelligence-hub/trip-profitability`) —
  revenue (per-km rate or lump sum) vs. every real trip cost, gross
  profit, margin, and the break-even rate below which a load loses money.
  `tripProfitability.ts` (10 tests). Route distance is a manual input —
  Google Maps Distance API integration is authorized but deferred to
  Phase B, per the locked decision.
- **Fuel Cost & Efficiency** (`/intelligence-hub/fuel-efficiency`) —
  actual vs. expected consumption for a trip, cost variance, and a
  threshold-based anomaly flag (>10% over = worth a look, >20% = worth
  investigating). `fuelEfficiency.ts` (8 tests).

25 tests total across the three engines, `npm run test`. All three status
flags (Trip Profitability's healthy/thin-margin/loss, Fuel Efficiency's
below/normal/above/significantly-above) are fixed threshold rules, not AI
judgement — real Layer 1 logic, same discipline as the raw numbers.

`src/components/intelligence-hub/NumberField.tsx` holds the shared form
input + `toNumber`/`formatZmw` helpers all three calculators use, factored
out after Cost Per Kilometre to avoid three copies drifting apart.

**Phase B (Layer 2 — AI enhancement infrastructure) is complete.** Every
Phase A calculator now has an optional "Get AI Insight" panel below its
results:
- `src/lib/ai/providers/{deepseek,gemini}.ts` — one adapter per provider
  behind a shared `AiProviderAdapter` interface
  (`src/lib/ai/providers/types.ts`). Implemented to each provider's
  documented API shape; **not yet verified against a live call** — no API
  key is available in this dev environment.
- `src/lib/ai/router.ts` — `completeWithFallback()` tries DeepSeek first,
  falls back to Gemini, skips whichever provider has no key configured,
  returns the first success (or the last failure if both fail/are
  unconfigured). 6 tests, using fake injected adapters — no network
  mocking needed.
- `src/lib/ai/rateLimit.ts` — a 24h-window, 20-requests-per-key in-memory
  limiter. **Honest limitation, not oversold**: this is a single-instance
  in-memory `Map`, which does not reliably persist across Vercel
  serverless cold starts, so it reduces accidental hammering but is *not*
  a real distributed rate limit. The actual $20/month spend ceiling
  (locked decision, plan §11) should be enforced on the DeepSeek/Gemini
  billing dashboard directly, not assumed to come from this code. 5 tests.
- `src/lib/ai/cache.ts` — a 6h in-memory response cache keyed by
  `feature:prompt`; never caches a failure. 5 tests.
- `src/lib/ai/prompts.ts` — the shared system prompt (2–4 sentences, no
  markdown, never invents data not present in the user's own prompt).
- `src/app/api/ai/complete/route.ts` — the one Route Handler every panel
  calls: `AI_FEATURES_ENABLED` kill switch → request validation → rate
  limit → cache lookup → `completeWithFallback()` → cache + return.
  Always responds `200` with `{ok:false, provider, reason}` on any
  failure (misconfigured/rate-limited/all-providers-failed) rather than a
  5xx — the client never has to special-case a network error separately
  from "no insight available right now." `400` only for a malformed
  request body.
- `src/components/intelligence-hub/AiInsightPanel.tsx` — the shared panel
  wired into all three calculators. Manual "Get AI Insight" button, never
  auto-fires on load or on input change. Violet-accented per the
  AI-content convention (`--df-ai-violet`, reserved and never decorative).
  Degrades on any failure to "AI insights are temporarily unavailable.
  Your calculation above is correct either way." — the calculator's own
  Layer 1 result is never blocked, hidden, or cast into doubt by an AI
  failure.

See `.env.example` for the environment variables Phase B reads (all
optional — every calculator's core result works with none of them set).

**Phase B's 3 additional engine-only calculators are also complete,
closing Phase B in full:**
- **Driver Pay & Advance** (`/intelligence-hub/driver-pay`) — gross pay
  (base + overtime + trip allowances), NAPSA, PAYE (progressive bands,
  applied after NAPSA per the standard order), NHIMA, an advance-recovery
  deduction clamped to both the outstanding balance and what's left after
  statutory deductions, net payable. `driverPay.ts` (8 tests).
- **Fleet Total Cost of Ownership** (`/intelligence-hub/fleet-tco`) — a
  year-by-year projection (purchase price, running costs that grow at a
  configurable rate as the vehicle ages, resale value that decays at a
  configurable rate, floored at 5% of purchase price) computing the
  equivalent annual cost at each year and identifying the lowest-cost
  replacement year — a genuine interior minimum when maintenance grows
  faster than resale decays, not just "the last year in the horizon."
  `fleetTco.ts` (6 tests). Deliberately no discounting/present-value or
  tax-shield modelling — kept simple on purpose, said so on the page.
- **Break-Even Utilisation** (`/intelligence-hub/break-even`) — break-even
  km/truck/month from the contribution margin (revenue − variable cost per
  km) against fixed costs, current utilisation vs. break-even, fleet-wide
  monthly profit, and a monthly cash-flow projection with an optional
  linear ramp-up period (a new truck/route rarely starts at full
  utilisation) showing which month cumulative cash flow turns positive.
  `breakEvenUtilisation.ts` (8 tests). An unprofitable rate (revenue below
  variable cost) is handled explicitly — "not achievable at this rate,"
  not a divide-by-zero or a misleading number.

All three reuse the same AI Insight panel pattern as the Phase A three —
`feature` is a plain string, no allowlist to extend on the Route Handler
side.

**63 tests total** (`npm run test`): 25 Phase A + 22 Phase B engines (8 +
6 + 8) + 6 router + 5 rateLimit + 5 cache.

**Phase C is also complete — the remaining 4 calculators, closing the
full 10-calculator Intelligence Hub portfolio in one round.** The plan
doc's own portfolio table (§05) tags Compliance & Penalty Risk / Tyre CPK
as "Phase C" and Load Optimisation / ROI & Payback as "Phase D," but the
separate roadmap section (§10 — the one the doc says actually governs
build sequencing) describes engineering Phase C as all 4 remaining
calculators reaching engine+Layer 2 parity together. That's a real
inconsistency in the plan doc itself, not a misreading — flagged and
resolved with the user (build all 4 now) rather than silently picking one
reading.
- **Compliance & Penalty Risk** (`/intelligence-hub/compliance-risk`) —
  up to 4 user-named/user-dated compliance documents (rename any row —
  no hardcoded regulatory jargon), expiry countdown, expired/expiring-
  soon(30d, the same threshold DeployFleet's own compliance tracking
  uses)/valid status, total renewal cost, and penalty exposure summed
  only from currently-expired documents. The penalty figure is always the
  user's own estimate — no published fine schedule is invented.
  `complianceRisk.ts` (10 tests).
- **Tyre Cost Per Kilometre** (`/intelligence-hub/tyre-cost`) — budget vs.
  premium tyre options compared on lifecycle cost per km (purchase price
  + retreads, each retread carrying its own cost and km life), plus
  annual cost per vehicle scaled by tyre position count and distance.
  `tyreCostPerKm.ts` (9 tests).
- **Load Optimisation & Axle Weight** (`/intelligence-hub/load-optimisation`)
  — up to 4 axle groups (steering-single/drive-single/tandem/tridem),
  each checked against sourced harmonized axle load limits with the
  source framework's own 5% tolerance, plus a gross-vehicle-mass check
  against sourced 48-tonne(6-axle)/56-tonne(7+-axle) caps — explicitly
  "not applicable" below 6 axles rather than guessing a number. A
  real, demonstrated scenario in testing: every individual axle group can
  be compliant while the total GVM is still overloaded — the calculator
  catches this, not just per-axle limits. `loadOptimisation.ts` (8 tests).
- **DeployFleet ROI & Payback** (`/intelligence-hub/roi-payback`) —
  user-supplied monthly subscription cost and one-time setup cost against
  user-estimated monthly savings across 5 categories, payback period,
  and 3-year ROI. No DeployFleet price is hardcoded anywhere — pricing is
  still an open question (see above), so this calculator never assumes
  one for the user. `roiPayback.ts` (8 tests).

All four reuse the same AI Insight panel pattern as every prior
calculator. `NumberField.tsx` gained three siblings for this round —
`TextField`, `DateField`, `SelectField` — the first calculators in the
suite needing non-numeric input (a compliance document's name/date, an
axle group's type).

**35 tests total this round** (10 + 9 + 8 + 8). **98 tests total overall**
(`npm run test`): 25 Phase A + 22 Phase B + 35 Phase C engines + 6 router
+ 5 rateLimit + 5 cache.

**All 10 calculators are now live** in `intelligenceHubCalculators`
(`src/lib/nav.ts`) and listed on the Hub index under "Available now" — the
"Coming next" section is gone entirely. This closes the Intelligence Hub
build per the plan's roadmap §10; nothing further is scoped there beyond
Phase E (accounts, memory, monetisation), explicitly out of scope until
the "no sign-up required" constraint itself is revisited.

**Benchmark data** (`src/lib/benchmarks.ts`) — every value is sourced and
dated, per the data-integrity rule in the plan §06:
- Diesel price: K26.86/litre, ERB Zambia, 1 Aug 2026 — flagged in the UI
  as volatile (moved >K4/litre month-to-month through 2026), not a stable
  constant.
- NAPSA: 5%+5% split, K37,236/month ceiling, capping the deduction at
  K1,861.80 — effective 1 Jan 2026.
- PAYE: progressive monthly bands (K0–5,100 at 0%, 5,101–7,100 at 25%,
  7,101–9,900 at 30%, above 9,900 at 37.5%) — cross-checked against two
  independent 2026 Zambian payroll guides after ZRA's own site (both the
  PAYE calculator page and the published PDF) returned `503` on every
  fetch attempt while sourcing this. Confidence is `medium`, not `high`,
  for exactly that reason — confirm against ZRA directly before relying
  on this for a real payslip. Same caveat applies to NHIMA (1% of gross,
  no cap), sourced the same way.
- Heavy-vehicle tolls: K300/gate (4+ axle), K200/gate (2–4 axle
  medium-heavy) — NRFA, effective 1 Jan 2026.
- Axle load limits: COMESA-EAC-SADC Tripartite harmonized limits
  (steering-single 8,000kg, drive-single 10,000kg, tandem 18,000kg,
  tridem 24,000kg, 5% in-transit tolerance) plus Zambia-specific GVM caps
  (48 tonnes at 6 axles, 56 tonnes at 7+ axles) — confidence `medium`,
  RTSA's own downloads page and related regional PDFs all returned
  403/503 while sourcing this, so it's cross-checked between the EAC
  Vehicle Load Control Act's published figures and an independently
  sourced Zambia-specific GVM figure that matches the harmonized ceiling
  exactly, not verified against RTSA directly. This is regulatory,
  safety-relevant data — treat it as a starting point for a real
  compliance decision, not a citation.

Only the diesel price is pre-filled into the Cost Per Kilometre form — the
other benchmarks appear as contextual help text (e.g. "5% of gross,
capped at K1,861.80") rather than a numeric default, since prefilling
NAPSA or tolls with a flat number would misrepresent figures that
genuinely depend on the user's own salary/route. Fields with no sourced
benchmark yet (fuel consumption, insurance, driver wages, tyres,
maintenance) are left blank rather than seeded with an invented "typical"
number.

## Messaging guardrails

Do not claim, anywhere on this site, without checking with the product
team first:

- That the domain model/workflows are "validated by real trucking
  operators" — that discovery hasn't happened yet.
- That a driver mobile app exists today — only dispatcher and customer app
  backends are built.
- That AI predictions (maintenance risk, fuel anomalies) are proven or
  accurate — they're real and demoable, but calibrated on synthetic demo
  data, not a real customer's history. Say "AI-powered insights," not
  "AI-proven forecasts."
- Don't call ZRA Smart Invoice submission "certified" or "government-
  approved" — the integration is built and described on the Compliance/
  Billing pages as a real capability, but it hasn't been verified against
  ZRA's actual sandbox yet. Describing what it does is fine; claiming it's
  officially certified is not.
- Guaranteed offline support in the field — architecturally intended, not
  confirmed tested.

Also avoid: "Odoo," "ERP," and generic SaaS filler ("seamless,"
"revolutionize," "cutting-edge"). DeployFleet's own product docs are
explicit that it should never read as an ERP with trucking fields bolted
on — the same applies here.

## Deployment

Deploys to Vercel. All environment variables are optional — see
`.env.example`. Without any set, the site builds and runs identically
except the Intelligence Hub's "Get AI Insight" panels show the graceful
"temporarily unavailable" state instead of a real completion.

To enable AI Insights in a given environment, set in Vercel's Project
Settings → Environment Variables:
- `DEEPSEEK_API_KEY` and/or `GEMINI_API_KEY` — at least one, to actually
  get completions (the router tries DeepSeek first, then Gemini).
- `DEEPSEEK_MODEL` / `GEMINI_MODEL` — optional, override the default model
  per provider.
- `AI_FEATURES_ENABLED=false` — optional kill switch to disable the
  feature entirely without removing the keys (e.g. to pause spend).
