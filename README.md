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
somewhere. **No labeled placeholders remain anywhere on the site** — the
homepage AI Copilot section's `ScreenshotPlaceholder` (originally waiting
on a dedicated Copilot Rail chat capture) was swapped for the same real
`copilot-console.jpg` used on `/product/ai-copilot`, matching this site's
existing pattern of reusing one product screenshot across both the
homepage and its dedicated product page (`dispatch-assign.png`,
`financial-intelligence.png`, and `compliance-center.png` all already did
this before this section image was filled). A dedicated Copilot Rail chat
capture (with a tool-lookup line visible) would still be a nice-to-have
swap later, but the site no longer has a dashed "screenshot needed" box
anywhere — this environment has no network access to the live demo server
to capture one directly, so a real, already-existing product image was
the honest choice over leaving a placeholder or fabricating one.

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

**Homepage now cross-sells the Intelligence Hub directly**: a new
`CalculatorsSection` (`src/components/home/CalculatorsSection.tsx`) sits
between `TrustSection` and `ProofSection` — a soft, lower-commitment CTA
ahead of the harder "book a demo" `CtaSection` that follows it. Shows 6
of the 10 calculators (a curated spread across cost/revenue/HR/asset/
compliance/software-ROI, not just the first 6 in `nav.ts`'s array, which
cluster on Phase A/B cost calculators), each with a small inline SVG icon,
its real description from `intelligenceHubCalculators` (the same single
source of truth the `/intelligence-hub` index page reads from — nothing
duplicated), and an "Explore all 10 calculators" button linking to the
full hub.

- **WhatsApp number** — `WHATSAPP_NUMBER` in `src/lib/nav.ts` is set to
  `260979046745`, sourced from the number printed on the hero promo
  graphic. Not independently verified — confirm it's the right, current
  number before launch.
- **Pricing** — no fixed numbers exist yet (open question in the product's
  own architecture docs). The pricing page intentionally shows tiers by
  what's included, not by price, funneling to a conversation instead.
- **Lead capture** — both forms (`DemoForm` on `/contact`, the homepage
  `CtaSection`) still submit by opening a pre-filled WhatsApp chat
  client-side as the real, primary path, and now *also* persist to
  Firestore for the admin dashboard — see "Lead capture, gated demo
  access, and visitor stats" below for the full picture. No CRM beyond
  this project's own `/admin` exists.

## Gated demo access

**Implemented** — this section used to describe a planned decision; see
"Lead capture, gated demo access, and visitor stats" below for what
actually shipped. `/demo` now collects the visitor's details first via
`DemoGate.tsx`, *then* reveals `LIVE_DEMO_URL`
(`http://199.192.23.46:4169/odoo`) — the unlock persists per-browser, so
a returning visitor isn't asked twice. A personalized one-click login
link (per-prospect demo instances, the way `deployfleet_demo_zm`'s
generation pattern suggests is possible) remains a real, separate idea
this doesn't attempt — everyone unlocking the gate still lands on the
same shared live demo instance.

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

### Experience Layer — the "Fleet Control Panel" redesign

Full audit and plan published as an artifact:
[Intelligence Hub — Experience Layer & Multi-Country Plan](https://claude.ai/code/artifact/c97e0e47-3175-4341-8401-8449504b0afa).
Governing reframe: not "calculator," not "dashboard," but a **control
panel** — controls on one side, live-responding instruments on the
other. All net-new components live in `src/components/intelligence-hub/`
alongside the original `NumberField`/`TextField`/`DateField`/`SelectField`
set, which stays exactly as-is for fields a slider genuinely doesn't fit
(dates, free text, categorical selects):

- **`SliderField`** — native `<input type="range">` (accessible by
  construction: keyboard arrows, screen readers) with a custom CSS
  thumb/track (`.df-slider` in `globals.css`) and a gradient fill computed
  inline from the live value. The numeric label is always directly
  editable on tap — precision typing is never sacrificed for tactility.
- **`StepperField`** — `[ − ] value [ + ]`, 44px touch targets, for
  discrete counts.
- **`HeroMetric`** — the big result number counts through intermediate
  values on change (~450ms, framer-motion's imperative `animate()`
  driving `textContent` directly, not a React re-render per frame) rather
  than jumping instantly. Snaps immediately under
  `prefers-reduced-motion`.
- **`HealthGauge`** — a segmented horizontal bar (not a radial dial —
  cheaper to build well, reads faster on a narrow mobile card) using the
  *existing* `--df-emerald`/`--df-amber`/`--df-danger` tokens, spring-
  animated. Not force-fitted onto every calculator — Cost Per Kilometre
  deliberately doesn't have one, since it has no natural pass/fail
  threshold the way margin-based calculators do; inventing one would
  violate the same never-fabricate discipline that governs the benchmark
  data.
- **`MiniBarChart`** — `recharts`, no axes/gridlines/legend. A handful of
  labeled cost-breakdown bars, not a BI chart.
- **`ScenarioRow`** — tap-to-apply what-if chips (`Scenario<TInputs> =
  { label, apply: (inputs) => inputs }`), each a pure transform re-run
  through the same unmodified engine function. The single highest-
  leverage addition beyond the five-layer formula: it's the mechanism
  that turns "fill in a form once" into "explore for two extra minutes."
- **`.df-tilt-card`** — a CSS-only, fixed-angle 3D hover tilt (no mouse-
  tracking JS). The deliberate, documented alternative to a WebGL/
  three.js dependency: this is a form-dense calculator UI for a mobile-
  first, often data-constrained audience, not a hero showcase, so a real
  3D engine's bundle/performance cost isn't worth it here.

**Cost Per Kilometre was the flagship retrofit** — every input a
`SliderField` (ranges sized to the selected country's own currency scale
via a diesel-price-derived magnitude proxy, so a K3,000 ZMW slider and a
US$3,000 slider both get sensible ranges), the results panel leads with
an animated `HeroMetric`, a `MiniBarChart` cost breakdown, a `ScenarioRow`
(Fuel ±10%, Distance +20%, Driver wages +10%, Cut maintenance 15%), and
the `.df-tilt-card` treatment. **The Control Panel treatment has since
been rolled out to all 9 remaining calculators**, closing the rollout
gated behind this flagship proving the pattern first:

- **Trip Profitability, Driver Pay & Advance, Fleet TCO, Break-Even
  Utilisation** — sliders/steppers throughout, an animated `HeroMetric`
  headline, a `MiniBarChart` breakdown, and 5 scenario chips each. Driver
  Pay and Break-Even also get a `HealthGauge` (take-home share vs. gross;
  utilisation vs. break-even) — a natural fit since both numbers are
  already percentage-of-healthy metrics, unlike Cost Per Km's total
  figure.
- **Compliance & Penalty Risk, Tyre Cost Per Km, Load Optimisation & Axle
  Weight, ROI & Payback, Fuel Cost & Efficiency** — same treatment, plus
  two genuinely new interactions rather than generic scenario chips where
  the domain called for it: Compliance & Penalty Risk's scenario row
  **fast-forwards the engine's reference date** (+30/60/90 days) to show
  expiry risk building over time, without touching the real system clock;
  Load Optimisation shows a **`HealthGauge` per axle group** (load vs. its
  legal limit), not just one summary number, since a single overloaded
  axle is the actual failure mode a weighbridge checks for.

Every retrofit reuses the same component set with zero new primitives —
the five-layer formula and the six components proved sufficient across
all 10 calculators' genuinely different shapes (single-truck economics,
multi-year projections, per-document compliance tracking, per-axle
regulatory checks, and a two-option comparison).

**Real bug caught during click-testing** (not caught until actually
switching countries in a browser): the diesel-price slider didn't
re-baseline when switching countries, so a scenario-adjusted Zambia-scale
price (~K29/L) carried over verbatim into Zimbabwe's completely different
USD scale, producing a nonsense ~US$29/L default. Fixed by resetting the
"touched" flag during render when `countryCode` changes — React's
documented pattern for "reset state when a prop changes" — rather than in
a `useEffect`, since this project's ESLint config (the React Compiler
plugin's `react-hooks/set-state-in-effect` rule) flags synchronous
`setState` calls inside an effect body as a cascading-render
anti-pattern. That same rule shaped `useSelectedCountry`'s design too —
see below.

### Multi-country support

Zambia stays the default. `src/lib/countries.ts` defines a
`CountryConfig` per country — currency, income tax bands, social
security, an optional secondary levy, tolls, and diesel price, each
independently `SourcedValue`-wrapped or honestly left `null`/zero rather
than guessed. **Never backfill a missing figure with another country's
number** — a missing figure means the UI shows "not sourced yet," not a
silently wrong answer in the wrong currency. **All 6 target countries are
now `coverage: "full"`** — South Africa, Botswana, Namibia, and
Mozambique were researched and populated in the same pass that rolled out
the calculator retrofit, closing what had been the plan's single largest
open gap; the `"currency-only"` coverage tier (and the
`currencyOnlyCountry()` helper that built it) is now unused code, removed
rather than left dead.

- **Zambia** — unchanged from the original single-country data.
- **Zimbabwe** — **priced in USD by explicit product decision**, not
  ZWG. Real sourced 2026 data: ZERA diesel price, ZIMRA's direct USD PAYE
  bands (annual) plus a 3% AIDS levy on the computed tax, and NSSA
  contribution rates.
- **South Africa** — SARS PAYE for the 2026/27 tax year, DMRE diesel
  (inland benchmark), UIF, and N3TC/SANRAL toll tariffs (De Hoek Plaza).
  The one genuinely interesting modeling problem: **SARS doesn't publish
  a 0% band** — it taxes from R1 at 18% and subtracts a flat annual
  primary rebate (R17,820). Converted into this app's plain additive-band
  schema as a `{from: 0, to: 99000, rate: 0}` band followed by the
  original SARS brackets unchanged — this is a mathematically **exact**
  conversion (R17,820 ÷ 18% = R99,000, SARS's own published "tax
  threshold"), verified to produce identical tax at every income level
  for a taxpayer under 65, not an approximation. Doesn't model the
  additional age-based secondary/tertiary rebates.
- **Botswana** — BURS PAYE (including the new 27.5% top band added 1 July
  2026), BERA diesel pricing. Genuinely has **no mandatory statutory
  social security** for private-sector employees (confirmed across
  multiple independent sources) and **no domestic toll-road network** —
  both modeled as real sourced zeros (`employeeRate: 0`,
  `fourPlusAxleHeavy: 0`), not missing data, so `coverage: "full"` stays
  honest.
- **Namibia** — Namibian tax bands for the 2026/27 year of assessment
  (tax year runs March–February), MME diesel pricing (Walvis Bay/coastal
  reference), and the Social Security Commission's 0.9%/0.9% contribution
  — its cap had a documented, dated increase (N$81 → N$99/month) on 1
  March 2025 that several secondary sources still report as the old
  figure; used the current one. Also genuinely has **no toll roads** —
  Namibia funds roads via fuel levies and distance-based charges instead
  — modeled the same real-zero way as Botswana's tolls.
- **Mozambique** — IRPS bands (**monthly**, unlike every other country
  here, which are annual — the engine already handled both periods),
  ARENE diesel pricing, and INSS (3% employee / 4% employer) with **no
  cap found in any source**, the first country in this app where a
  social-security cap doesn't exist — required widening
  `SocialSecurityConfig.employeeCapPerMonth` from `number` to
  `number | null` (and `driverPay.ts`'s cap logic to `?? Infinity`,
  mirroring the pattern `secondaryLevy` already used). Also has a genuine
  second payroll deduction beyond IRPS/INSS — **Imposto Pessoal
  Autárquico (IPA)**, a flat municipal tax collected through payroll
  rather than a percentage of salary — modeled via the existing
  rate-of-gross-capped-at-X `secondaryLevy` shape as `employeeRate: 1`
  capped at the flat amount (a deliberate trick to express "always
  exactly this flat figure," documented inline, not a real 100% rate).
  The only concrete IPA figure found is Maputo's 2022 rate — flagged
  `confidence: "low"` and as approximate rather than treated as current.
  Mozambique toll data (TRAC's N4 Moamba Plaza) is dated September 2023,
  the oldest `asOf` of any figure in this app, but confirmed via
  Mozambican press that the government's May 2025 tariff revision
  explicitly excluded heavy trucks — still the best-evidenced current
  figure.

Every country's data was gathered by parallel research passes (one per
country) against named primary/authoritative sources (SARS, BURS, NamRA-
equivalent, ARENE, DMRE, BERA, MME, INSS, SANRAL/N3TC, TRAC), each
citing a specific document and as-of date, with genuine source
disagreements flagged and resolved rather than silently picked — see
each country's `note` fields in `countries.ts` for the full reasoning
trail, not just the headline numbers.

**The `driverPay.ts` engine is country-parametric**, not Zambia-shaped —
it takes an `IncomeTaxConfig` (bands + a `period` of `"monthly"` or
`"annual"`, plus an optional `levyOnTaxPercent` for Zimbabwe's AIDS-levy
shape), a `SocialSecurityConfig`, and an optional `SecondaryLevyConfig`,
instead of hardcoded NAPSA/PAYE/NHIMA fields. All 6 countries are
exercised end-to-end (unit tests plus a live-browser check per country on
the Driver Pay calculator), covering the annual-to-monthly band
conversion, the levy-on-tax calculation, the uncapped-social-security
path, and the flat-secondary-levy trick — genuinely different shapes, not
just different numbers.

**The `Zmw` field-suffix removal (locked decision, option "c" from the
plan)**: `costPerKm.ts`, `tripProfitability.ts`, and `driverPay.ts` — the
3 calculators that actually touch country-specific tax/toll/currency data
— had their field names de-Zambia'd (`fuelPriceZmwPerLitre` →
`fuelPricePerLitre`, `napsa` → `socialSecurity`, etc.). The other 7
calculators' field names are untouched — they were never Zambia-specific
to begin with (Fleet TCO, Break-Even, etc. don't reference a currency in
their field names), so renaming them would have been churn with no
correctness benefit.

A `CountrySelector` (`useSelectedCountry`, `localStorage`-backed via
`useSyncExternalStore` — the React-recommended, hydration-safe pattern
for external mutable state, chosen specifically to avoid the same
set-state-in-effect lint violation noted above) is wired into all 3
country-sensitive calculators, defaulting to Zambia, persisting per-
browser like every other calculator input in this product.

### Lead capture, gated demo access, and visitor stats (Firebase)

Every form on the site (`/contact`'s `DemoForm`, the homepage `CtaSection`)
kept its original, always-working WhatsApp-open behavior unchanged, and
now *additionally* persists a fire-and-forget lead to Firestore
(`src/lib/leads.ts`) so submissions show up in `/admin` — a strict
addition, never a replacement; a Firestore write failure never blocks or
errors the WhatsApp handoff a visitor is relying on. `/demo` implements
the "Planned: gated demo access" behavior this README used to just flag
as a future decision: `DemoGate.tsx` shows the lead form first (`source:
"demo-gate"`), and only reveals `LIVE_DEMO_URL` after a real submission —
the unlock persists per-browser via `useDemoUnlocked()` (`localStorage`,
the same `useSyncExternalStore` pattern as `useSelectedCountry`), so a
returning visitor isn't re-gated. Page-view tracking itself has since been
superseded by the real Visitor Intelligence 2.0 pipeline below — the
original `PageviewTracker`/`logPageview()` (one bare Firestore doc per
navigation, no sessions, no UTM, no device/geo) has been removed; the
`pageviews` collection it wrote stays in Firestore as read-only history
and is folded into real visitor records by the Visitors tab's backfill
action, not deleted.

**Security model, not an afterthought:** `firestore.rules` (repo root)
allows unauthenticated `create` on `leads`/`pageviews` only — field-
validated (required keys, string-length caps, `status` locked to `"new"`
on create) — and denies read/update/delete to every client entirely.
There's no visitor to authenticate against on a marketing form, so the
write path has to be public; the actual security boundary is that
validated create-only rule, not the `firebaseConfig` values shipped in
the client bundle (those are non-secret by Firebase's own design — see
the comment in `src/lib/firebase.ts` for why hardcoding them as a
fallback default, the same choice already made for `WHATSAPP_NUMBER` in
`nav.ts`, is fine). Admin reads/writes (the dashboard, lead-status
updates) go through `src/lib/firebaseAdmin.ts`'s privileged, server-only
Admin SDK instead, which bypasses these rules under a service-account
credential — the two paths never share a permission model.

**This repo cannot deploy `firestore.rules` or create the Firestore
database itself** — both require your own Firebase account access.
Before any of this works end-to-end: create the Firestore database
(Firebase Console → Build → Firestore Database → Create Database — **not
done yet as of this writing**, confirmed by a direct REST call returning
`PERMISSION_DENIED`/`SERVICE_DISABLED`, not a network failure — outbound
HTTPS to `firestore.googleapis.com` from this dev environment works
fine), then paste `firestore.rules` into the Rules tab and Publish (or
`firebase deploy --only firestore:rules` with the CLI).

### Visitor Intelligence 2.0

A real first-party visitor/session/event analytics layer, built by
evolving the old bare `pageviews` counter above rather than replacing it
outright — audited first (see git history around this section), then
extended: one canonical pipeline, not two competing tracking systems.

**Data model** (`src/lib/visitorTypes.ts`, `src/lib/visitorIntelligence.ts`)
— three Firestore collections: `visitors` (one doc per browser/device,
first/last-touch attribution, engagement/intent scores, device/geo),
`visitorSessions` (30-minute-inactivity session boundaries, landing/exit
page, UTM/referrer attribution), `visitorEvents` (page views, CTA/
WhatsApp/phone clicks, form steps, calculator completions — a fixed
`EventType` union, not free text). All three are server-managed only —
every write goes through `/api/analytics/*` (Next.js Route Handlers using
the Admin SDK), never the client Firestore SDK directly, which is what
makes the trust model below possible; `firestore.rules` has no rules for
them at all, relying on its existing catch-all deny.

**Server-side trust model (Fingerprint), not a client-trusted id.** The
browser gets a Fingerprint `event_id` (`@fingerprint/react`'s
`useVisitorData()`, wired in `src/components/analytics/VisitorTracker.tsx`
inside `FingerprintBoundary.tsx` — both gracefully no-op, exactly like the
Clerk provider, when `NEXT_PUBLIC_FINGERPRINT_PUBLIC_API_KEY` isn't set)
and nothing else — no `visitorId`, no confidence score, no device/bot
signal it could tamper with. `/api/analytics/identify` takes that
`event_id`, resolves it server-side via `src/lib/fingerprintServer.ts`
(the official `@fingerprint/node-sdk` Server API client, field names read
directly from that package's own generated OpenAPI types rather than a
guessed response shape), and only then writes the trusted result. Without
a real key, `identifyVisitor()` falls back to the pre-existing
localStorage id (`getLegacyVisitorId()` in `client.ts`, same storage key
the old `PageviewTracker` used) so a returning visitor on the same browser
still resolves to the same visitor doc — degraded, not broken.

**Client SDK** (`src/lib/analytics/client.ts`) — one singleton
(`analytics.identify/page/track/conversion/endSession`), not hand-rolled
`fetch()` calls scattered through components. `page()` resumes an existing
session server-side if it's still within the inactivity window, otherwise
starts a new one; a 10-15s heartbeat (`document.visibilityState`-gated,
stops when hidden) accumulates real active-time instead of the classic
`nextPageTimestamp - pageViewTimestamp` inaccuracy; `endSession()` fires
via `navigator.sendBeacon` on `pagehide`/tab-hide so it survives a closing
tab. Deliberate v1 simplification: "visible" is treated as "active" (no
separate mouse/keyboard idle detection yet).

**Scoring** (`src/lib/analytics/scoring.ts`) — engagement and intent are
two separate 0-100 scores with their own weight tables (page views,
calculator use, pricing views, WhatsApp/phone clicks, demo requests, a
returning-session bonus), accumulated incrementally per event via
Firestore `FieldValue.increment()` rather than recomputed from full event
history on every hit — cheap, at the cost of not being retroactively
recalculable if the weights ever change. `engagementBand()`/
`intentCategory()` turn the raw score into the labels the Visitors tab
shows (Low/Moderate/Engaged/Highly Engaged/High Intent; Cold/Warm/
Interested/High Intent/Sales Ready).

**Conversion events wired so far:** WhatsApp clicks (the floating button
and both Navbar links — global, every page), demo/contact form
submissions (`DemoForm`/`CtaSection`, split into `demo_request` vs.
`contact_request` by the form's own `source` prop), and a
`calculator_complete` proxy fired from the shared `AiInsightPanel`'s "Get
AI Insight" button (the one discrete, intentional action available across
all 9 calculators, which otherwise live-recalculate on every keystroke
with no explicit submit button to hang a real start/complete pair off
of — documented as a deliberate proxy, not a literal form-completion
event). **Deliberately not yet wired:** the many one-off WhatsApp CTAs on
individual marketing pages (about/pricing/solutions/resources/product/*)
— `src/components/analytics/TrackedWhatsAppLink.tsx` exists as the
drop-in replacement for when that's worth doing; only `/contact`'s hero
CTA uses it so far. No `tel:`/`mailto:` links exist anywhere in this
codebase (WhatsApp is the only contact channel), so `phone_click`/
`email_click` have no call sites to wire.

**Backfill, not data loss:** `backfillVisitorsFromPageviews()`
(idempotent, marker-field pattern — same shape as `crm.ts`'s
`syncLeadsToCompanies()` from an earlier session, triggered on demand
rather than via a Cloud Function/Blaze billing plan) groups the legacy
`pageviews` docs by their old localStorage id and folds them into real
`visitors` records — a "Backfill legacy pageviews" button in the Visitors
tab, not an automatic migration, since it's a heavier one-time operation.

**Phase 2 (Intelligence) is now built.** `submitLead()` (`src/lib/leads.ts`)
returns the new lead's id; `DemoForm`/`CtaSection` pass it to the client
SDK's new `analytics.linkLead(leadId)`, which calls `/api/analytics/
link-lead` → `linkVisitorToLead()` — the anonymous visitor's `status`
flips to `"identified"` and their `leadId` is set, closing spec §18/§38's
"anonymous visitor → identified lead, full history attached" requirement.
Best-effort and non-blocking, same discipline as `submitLead()` itself: a
failed link never undoes the lead that was already saved. The Visitors
tab's expanded card is now a real profile (spec §20's Identity/
Engagement/Acquisition/Geography/Technology/Behavior/Timeline sections),
not just a timeline — still inline in the list rather than a separate
route, since Next.js dynamic-route plumbing wasn't worth the extra
surface for what's still a single-admin dashboard.

**Phase 3 (Geographic Intelligence) is now built, minus the map itself.**
A new **Geography** tab: a Today/7d/30d/90d/All-time selector,
`getGeographyBreakdown()` (`src/lib/visitorIntelligence.ts`) grouping
`visitors` by country → city with visitor/session counts, average
engagement, high-intent counts, and a real join against `visitorEvents`
for demo/contact-request counts per country. No hardcoded city list
(spec §17) — Zambian cities (or any others) surface naturally from
whichever real visitor data exists. **No Google Maps integration** — no
API key is configured for it, so this stays a sortable, expandable table
rather than a plotted map; spec §16 itself prefers a heatmap/cluster view
over "thousands of individual markers" anyway, so the table isn't a
placeholder for the real thing, it's a reasonable v1 on its own. Add
`GOOGLE_MAPS_API_KEY` (server-only, for reverse geocoding — spec §15
explicitly warns against calling Geocoding directly from the browser) if
a real map view becomes worth building.

**Not yet built (Phase 4/5 of the spec, tracked but out of scope for this
pass):** the SEO opportunity engine, the AI marketing-intelligence layer
(would reuse the existing DeepSeek/Gemini router — same one the
calculators' "AI Insight" panels already use), real-time active-visitor
view, and configurable alerts. Content Performance (per-page views/
engagement/conversion-rate reporting) also isn't built yet — the raw data
(`pageViewCounts` per visitor, `page_view` events) exists to build it
from, just not the report itself.

### Admin dashboard (`/admin`)

**Auth is now Clerk, not the old shared-password HMAC-cookie gate** — the
migration this project's own code comments had been flagging as planned
since the diesel-price editor first shipped. Two independent, both-
required gates, checked server-side in `src/app/admin/page.tsx` before
any dashboard content renders:

1. **Clerk** (`src/proxy.ts` — Next.js 16 renamed the Edge Middleware file
   convention from `middleware.ts` to `proxy.ts`; same `clerkMiddleware()`
   API) protects every `/admin` route, redirecting a signed-out visitor to
   Clerk's own hosted Account Portal sign-in — no custom sign-in page was
   built, since Clerk's default requires zero extra code. Gracefully
   no-ops (passes every request through untouched) when
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` aren't set, the
   same "degrade instead of crash without credentials" contract every
   other optional integration in this project follows — `clerkMiddleware()`
   itself throws on missing keys, so this guard is load-bearing, not
   decorative.
2. **`ADMIN_ALLOWED_EMAILS`** (`src/lib/adminAccess.ts`) — a signed-in
   Clerk user isn't automatically trusted with lead/visitor data; this is
   the second gate Clerk itself doesn't know about. Fails closed: unset
   means nobody is admitted, not "anyone signed in," matching the old
   password gate's own `isAdminConfigured()` discipline exactly.

`src/lib/firebaseAdmin.ts` is the third piece — server-only, privileged
Firestore access via a Firebase service account
(`FIREBASE_ADMIN_PROJECT_ID`/`FIREBASE_ADMIN_CLIENT_EMAIL`/
`FIREBASE_ADMIN_PRIVATE_KEY`), independent of Clerk entirely (Clerk
proves identity; the Admin SDK is a separate, unrelated credential for
data access — no Clerk↔Firebase token-exchange integration was needed
or built). Missing this only degrades the Overview/Leads/Visitors/Geography
tabs to a clean "not configured" message; Clerk auth and the Diesel Prices
tab (still on `adminStore.ts`'s Upstash-Redis-backed store, untouched by
this round) work independently of it.

**Five tabs**, all in `src/components/admin/`:
- **Overview** — pageview counts (all-time, last 7/30 days, unique
  visitors via a locally-generated `localStorage` id, no cookies or
  fingerprinting), leads-by-pipeline-status counts, and a top-10-pages
  table. `/api/admin/stats` computes this with Firestore's own `.count()`
  aggregation queries for the cheap totals and a single bounded
  (5,000-doc) fetch of the last 30 days' pageviews for the detail that
  actually needs the raw docs (unique visitors, per-path counts) —
  deliberately not a `.where().orderBy()` composite-index query, which
  would need a manual index created in the Firebase console first.
- **Leads** — every lead from all 3 sources (Contact form, homepage CTA,
  demo gate), filterable by source, each with a real pipeline-status
  dropdown (`new` → `contacted` → `demo-booked` → `customer`/`lost`,
  `src/lib/leadTypes.ts`) that `PATCH`es `/api/admin/leads` — this is the
  concrete interpretation of "leads and sales" the dashboard implements:
  a status field per lead, not a separate deals/revenue data model, since
  nothing else in this marketing site (no billing, no CRM) gives a "sale"
  any other meaning yet.
- **Visitors** — the Visitor Intelligence 2.0 pipeline's dashboard surface
  (see the section above): a filterable (status, minimum intent score)
  visitor list with engagement/intent score badges, an expand-to-load
  full profile (`/api/admin/visitors/[id]`, merging session boundaries
  and events chronologically for the timeline), and the legacy-pageviews
  backfill trigger.
- **Geography** — the Phase 3 country/city breakdown (see the section
  above): a Today/7d/30d/90d/All-time range selector, an expandable
  country table with visitor/session/engagement/high-intent/demo-request
  counts, no map yet.
- **Diesel Prices** — unchanged from before, just re-gated: same
  `adminStore.ts` A-to-C Upstash bridge, same UI, only the auth check on
  `PUT /api/diesel-price` swapped from the old session cookie to
  `requireAdmin()`.

`src/lib/leadTypes.ts` exists specifically so `LeadSource`/`LeadStatus`
can be imported by both the client forms (`leads.ts`, which also pulls in
the client Firebase app) and the server route handlers (which use the
Admin SDK instead) without either side accidentally initializing the
wrong SDK.

**Both items previously listed here as open — rolling the Control Panel
component set to the other 9 calculators, and researching/populating
South Africa/Botswana/Namibia/Mozambique's tax/toll/diesel data — are
done** (see "Experience Layer" and "Multi-country support" above).
**Genuinely still open, not blocking:** confirming whether the harmonized
axle-load limits sourced for Load Optimisation actually apply as-is to
South Africa and Namibia rather than assuming uniform Tripartite coverage
(`AXLE_LOAD_LIMITS` in `benchmarks.ts` is still one shared, Zambia-sourced
set used for every country); creating the Firestore database and
deploying `firestore.rules` (see above — needs your Firebase account,
not something this repo can do alone); creating the actual Clerk
application and generating a Firebase service account (same reason); and
verified end-to-end in a real browser only up to the point this dev
environment's missing credentials allow — the `/admin` "not configured"
gate, the `/demo` gate's full lock→submit→unlock→persist-across-reload
cycle, and a real Firestore write's request reaching
`firestore.googleapis.com` (confirmed via direct HTTPS reachability, not
assumed) are all confirmed; a real Clerk sign-in and a real Firestore
write actually succeeding are not, since neither is possible without
credentials only you can generate.

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
