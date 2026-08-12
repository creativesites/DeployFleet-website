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

**Phase 4 and 5 are now built too** — Content Performance, Campaigns
(source/campaign + funnel), Real-Time, and Insights (alerts + AI
narrative). See the "Admin dashboard" section below for the full
breakdown. The one deliberately-still-open piece from the original
spec is the **SEO opportunity engine** — it needs organic-only traffic
segmented per page, which needs every `VisitorEvent` to carry its
session's referrer type (only `VisitorSession` does today); the Content
page's classification badges cover the rest of spec §24's label set
without it.

### DeployFleet's own CRM ("Today" and "Prospects")

Everything above — Visitor Intelligence 2.0's five phases — is about
*website visitors*. This section is different: it's DeployFleet's own
internal sales pipeline, for DeployFleet's own team (Winston, the human
salesperson, plus the AI-worker workflow described in the GTM Strategy /
Sales Playbook / Operating Rhythm briefs) to run outbound and inbound
sales against. It was scoped in an earlier planning pass in this same
session, shelved when the Visitor Intelligence 2.0 brief arrived, and
picked back up at explicit user direction once all five of that brief's
phases were done — with one addition: leads promoted into this CRM now
carry their linked visitor's real engagement/intent data from day one,
not as a later integration.

**Data model** (`src/lib/crmTypes.ts`, `src/lib/crm.ts`) — two Firestore
collections, deliberately separate from Visitor Intelligence's
`visitors`/`visitorSessions`/`visitorEvents`: `prospects` (the pipeline
record — contact facts, the brief's 13-stage pipeline (0 Unqualified
through 12 Nurture), next-action date/type/note, a provenance-tagged
`intelligence` map) and `interactions` (one row per call/WhatsApp/note
logged against a prospect). Every AI-derived intelligence field carries
`{value, source, sourceType, confidence, verified, generatedAt}` —
`sourceType` is `"ai_research"` for anything the AI brief generates,
never silently indistinguishable from a human-confirmed fact, per the
brief's own "human-confirmed beats AI inference beats a campaign
assumption" hierarchy.

**Phone intelligence** (`src/lib/phoneRules.ts`, unit-tested) — a
configurable, Zambia-specific ruleset (211-218 = landline; 97/77/57 =
Airtel; 96/76 = MTN, all as the digit-string that remains once the `260`
country code or a local leading `0` is stripped) recommending call vs.
WhatsApp per prospect, plus a round-number/sequential-digit pattern-
anomaly flag that's surfaced, never used to reject a number outright —
exactly the brief's "flag ≠ reject" distinction.

**The two AI round-trips** (`src/lib/ai/prompts.ts`'s
`SDR_BRIEF_SYSTEM_PROMPT`/`NOTE_EXTRACTION_SYSTEM_PROMPT`, reusing the
same DeepSeek/Gemini router every other AI feature on this site uses —
no second provider integration) both return structured JSON
(`src/lib/ai/jsonExtract.ts` strips a stray markdown fence a model
sometimes wraps it in, then parses; a malformed response degrades to
"unavailable," never a crash): **"Prepare Me"**
(`/api/admin/crm/prospects/[id]/brief`) turns a prospect's raw facts —
plus their linked visitor's engagement score, intent score, and top
pages, when one exists — into a fleet-tier estimate, likely pain,
recommended wedge, recommended channel, a discovery question, and a
priority score, written into the intelligence map. **Note parsing**
(`/api/admin/crm/prospects/[id]/parse-note`) turns Winston's own
freeform call/WhatsApp note into a suggested `{stage, pain,
nextActionDate, nextActionType}` — returned for the Today tab to show as
an editable suggestion, never applied directly; brief #35's own rule
("no AI write path skips human confirmation") is enforced by this
route doing no Firestore write at all, only the human-triggered
follow-up `PATCH`/`POST` does.

**The "No Orphan Lead" closure** — `syncLeadsToProspects()` promotes
every un-promoted `leads` doc (Contact form/homepage CTA/demo gate) into
a real prospect, idempotent via a `promotedToProspectId` marker, same
shape as `visitorIntelligence.ts`'s own pageviews backfill. The linked
visitor is found via a *reverse* lookup (`visitors` where `leadId ==`
this lead's id) — `linkVisitorToLead()` only ever writes that
relationship onto the visitor doc, never back onto the lead, so this is
a single-field equality query, no composite index needed. When a match
exists, the new prospect's `visitorSnapshot` carries the visitor's real
session count, page-view count, top pages, and engagement/intent scores
at promotion time (a snapshot, not live-refreshed — a deliberate v1
simplification, same as several other point-in-time snapshots elsewhere
in this project), and `priorityScore` is seeded directly from the
visitor's `intentScore` rather than starting blank. An inbound form
submission starts at stage 3 ("First Contact" — their own outreach *is*
the first contact) instead of stage 1 ("Researched"), which is where the
52-company outbound cold list (`src/lib/prospectSeedData.ts`,
transcribed verbatim from the CSV the user provided, seeded idempotently
by company name via `seedProspectsFromCsv()`) starts instead, since
nobody's attempted contact with those yet.

**Five screens**, all nav items under the sidebar's CRM group (ahead of
Analytics — see "Admin dashboard" below):
- **Today** (`/admin/today`) — Winston's actual daily queue: prospects
  due today or overdue, oldest first. Each card shows the AI brief (or
  a "Prepare Me" button if none exists yet), a website-engagement badge
  when the prospect is visitor-linked, real `tel:`/`wa.me` action links,
  outcome buttons (no answer/gatekeeper/wrong person/right
  person/meaningful conversation/demo booked/other — spec's own
  "attempted ≠ meaningful" distinction, kept as a separate field from
  pipeline stage), a note field with an optional AI-parse step, and
  editable stage/next-action fields Winston confirms before the
  interaction is logged and the prospect record updates. This is the
  actual vertical slice: prospect → brief → action → note → AI
  extraction → confirm → next action, closing the loop the original
  planning pass scoped and never built until now.
- **Prospects** (`/admin/prospects`) — the full pipeline, filterable by
  stage/source, expand-to-see-everything (facts, phone classification,
  AI brief, linked visitor snapshot, full interaction history), the
  "Seed outbound list + sync leads" trigger button, and (Phase 0, new)
  an "Add prospect" form for manually entering a prospect that didn't
  come from the CSV seed or a promoted lead — reuses the same
  `computePhoneClassification()` helper as the other two creation
  paths, tagged `flags: ["manual-entry"]` for provenance.
- **Pipeline** (`/admin/pipeline`, Phase 0, new) — the brief's own
  Kanban board: a horizontal-scroll, stage-by-stage column layout (all
  13 stages, 0 Unqualified through 12 Nurture). Tap-to-move via a
  per-card "Move to..." select rather than drag-and-drop — a deliberate
  mobile-first choice, since Winston works this from a phone as often
  as a desktop and HTML5 drag-and-drop has poor touch support (the same
  reasoning the DeployFleet Odoo sibling project already settled for
  its own Dispatch Board).
- **Targets** (`/admin/targets`, Phase 0, new) — the Sales Playbook's
  own "10 attempts, 5 meaningful interactions" daily benchmark, tracked
  as a real weekly scoreboard: a Monday-start week selector, day-by-day
  attempt/meaningful-interaction counts against the target (green when
  met), and weekly totals. `getWeeklyScoreboard()`
  (`src/lib/crm.ts`) computes this from a single bounded fetch of the
  `interactions` collection, filtered in-memory by date range — no
  Firestore composite index, consistent with this project's
  index-avoidance discipline everywhere else.
- **Outreach** (`/admin/outreach`, Phase 0, new) — campaign tracking as
  its own entity (the brief's "DeployFleet — Today's 10" example, made
  real instead of an implicit daily habit): create a `Campaign`
  (name/start-end dates/optional attempt and meaningful-interaction
  targets), assign unassigned prospects to it via a checkbox list, and
  see a real per-campaign scoreboard (`getCampaignScoreboard()`) —
  prospect count, attempts, and meaningful interactions, computed by
  joining the campaign's prospect ids against the same bounded
  `interactions` fetch Targets uses. Named "Outreach" in the UI
  specifically to avoid colliding with the separate, unrelated Visitor
  Intelligence `/admin/campaigns` route (website traffic channels).

**Deliberately not built yet, per Phase 1+ of the architecture doc
below:** a separate `aiJobs` observability collection (the two AI
round-trips aren't logged anywhere beyond their effect on the prospect
record) and a Sales Coach call-analysis feature. **Not verified in a
live signed-in browser**, same standing caveat as the redesign above —
routing/auth-gating confirmed via curl (`/admin/today`'s first hit 404s
in Next.js dev mode before Turbopack compiles it on-demand, a real dev-
mode quirk, not a bug — the very next request correctly 307s to sign-in,
and the production build lists the route correctly).

**This CRM is the foundation for a much bigger next step: an AI-native
Marketing OS**, per [`docs/ai-marketing-os-architecture.md`](docs/ai-marketing-os-architecture.md).
**Phase 0** (Pipeline/Kanban, Targets, Outreach, the manual add-prospect
form, all documented above) **and Phase 1 — the intelligence foundation —
are both now complete**, built in the doc's own dependency order (§11):

1. **Context Compiler + Redis cache** (`src/lib/ai/contextCompiler.ts`,
   `src/lib/ai/contextCache.ts`) — the shared function every AI call in
   this system builds its prompt from, implementing §5's layered model
   (global/prospect/employee/immediate-task, never "dump the whole
   CRM"). Reuses the Upstash Redis integration already connected for the
   diesel-price editor (`adminStore.ts`'s `KeyValueStore`, which gained a
   `delete()` method this round) rather than a new integration.
   Invalidation is event-driven, not TTL-driven (a 24h TTL is only the
   backstop) — every `crm.ts` write function that touches a
   prospect/employee/global-scoped record calls the matching
   `invalidate*Context()`. Split into two files specifically to avoid a
   circular import: `crm.ts`'s write functions need to call
   `invalidateProspectContext()` etc., but the compile functions need to
   read `crm.ts` — `contextCache.ts` holds the key names and the
   Redis-delete side (zero `crm.ts` dependency), `contextCompiler.ts`
   holds the actual compile-and-cache logic.
2. **`facts`/`tasks`/`decisions`/`auditEvents`/`aiEmployees`/`inboxEntries`
   collections** (`crmTypes.ts`/`crm.ts`) — the append-only Fact ledger
   underneath `ProspectIntelligence` (still the compact "current best
   answer" a UI reads without a second query; `facts` is the full
   history), a real Task entity generalizing beyond
   `Prospect.nextActionDate` (assignable to an AI employee, not just a
   prospect), the never-edited-only-superseded Decision Ledger, and the
   append-only `AuditEvent` trail every write path above feeds. Also
   extended `Prospect` with `icpFitScore`/`opportunityScore` (deliberately
   separate from the existing `priorityScore` — "how good a fit" vs. "how
   big" vs. "how ready to buy") and `riskFlags`.
3. **Prospect Intelligence pages** (`/admin/prospects/[id]`) — header
   (scores, next action, risk flags, with an inline editor for the three
   new fields since nothing else in the UI can set them), five tabs:
   Overview (the flat facts the old expand-in-place panel showed),
   Intelligence (the compact summary plus full Fact history), Employee
   Intelligence (one paste box per AI employee, scoped to this prospect
   — "tabs to add information from each employee specific to that
   prospect," the feature Winston specifically asked for), Interaction
   history (unchanged), and Timeline (a merged, chronological view of
   interactions + facts + tasks + decisions + audit events, computed on
   read via `/api/admin/crm/prospects/[id]/timeline`, not a stored
   collection). `/admin/prospects`' own list keeps its expand-to-preview
   for fast scanning; both Today-tab cards and the Prospects list now
   link to the full page as the deeper action.
4. **AI Workforce / Team page** (`/admin/team`, `/admin/team/[id]`) — a
   one-click seed for 5 starter personas (AI SDR, AI Researcher, AI Sales
   Coach, AI Market Intelligence, AI SEO; the specific first names are
   reasonable placeholders, not transcribed from an original brief this
   session had access to — rename freely). Each employee's page: an
   editable Mission/standing-instructions section, a real Objectives/task
   list (add/status-change), a paste-box conversation feed, a
   deterministic Performance summary (task completion rate — no
   AI-generated review in Phase 1), and their past `inboxEntries`.
5. **The AI Inbox** (`/admin/inbox`, plus the same paste box embedded on
   Prospect and Employee pages) — "paste everything." `POST
   /api/admin/crm/inbox` creates the immutable `InboxEntry` and
   immediately runs `INBOX_EXTRACTION_SYSTEM_PROMPT`
   (`src/lib/ai/prompts.ts`) against the Context Compiler's known-context
   for whichever prospect/employee it's scoped to, returning a
   **proposal** (facts/tasks/decisions/risks/recommendations/
   contradictions) — never a silent write. The review UI
   (`InboxPasteBox.tsx`, the one component shared across all three paste
   surfaces) shows per-item Approve/Reject checkboxes, resolves each
   fact/task's `prospectRef` name string against a real prospect (a
   fixed prospect when the paste box is already prospect-scoped, or a
   per-item resolve dropdown otherwise), and only `POST
   /api/admin/crm/inbox/[id]/apply` — the human-approved step — actually
   writes to `facts`/`tasks`/`decisions`, each with an `AuditEvent`
   carrying `sourceInboxEntryId` for the provenance chain (brief #35: no
   AI write path skips human confirmation).
6. **Sales Coach call analysis** (§6.4) — not a separate feature, exactly
   as the architecture doc predicted: the same Inbox route runs a second
   pass with `SALES_COACH_SYSTEM_PROMPT` whenever `sourceType` is "call
   transcript," folding structured coaching feedback (what went well,
   missed opportunities, objections raised, the recommended next
   question) into the same review UI as `ExtractionResult.callAnalysis`.
7. **Decision audit trail** (`/admin/decisions`) — a flat list filterable
   by status/scope, a create form (global/prospect/employee scope,
   free-text evidence), and a "Supersede" action that creates the
   replacement and links both decisions bidirectionally — decisions are
   never edited in place.
8. **Reality &amp; Reconciliation Engine** (`src/lib/crm/reconciliation.ts`'s
   `runReconciliation()`) — five deterministic checks, no AI call (same
   "don't use AI for basic arithmetic" precedent as Visitor
   Intelligence's own `getAlerts()`): stale next actions (overdue 3+ days
   with no contact since), stalled facts (unchecked 30+ days — also
   marks them `reconciliation_required`), contradicting facts (the
   safety net for anything that slipped past the Inbox's own
   contradiction detection), orphaned decisions (prospect-scoped,
   prospect since archived), and prospects past first contact with no
   decision-maker name recorded. A manual "Run reconciliation" button on
   the existing `/admin/insights` page — additive to that page's Alerts
   feed, not a new page, exactly as the doc specified — each flag writing
   a `reconciliation_flag_raised` `AuditEvent`.

**Nine new/changed routes** under the CRM sidebar group: Prospect
Intelligence pages, Team + per-employee pages, the AI Inbox, and
Decisions join Today/Prospects/Pipeline/Targets/Outreach.

**Deliberately deferred to Phase 2+, not silently dropped:** tool-calling
in the AI router, the AI Orchestrator and its tool registry, autonomy
levels, the System State object, the AI Command Center redesign of
`/admin`, the system-wide activity feed, and the anti-procrastination
engine — all explicitly gated in the doc on Phase 1 being in real daily
use first. Two smaller Phase-1-adjacent simplifications, disclosed rather
than hidden: `createFact()` does not automatically project matching keys
back onto `ProspectIntelligence`'s named fields (that map is still
written directly by the SDR brief route) — `facts` is its own ledger,
browsable on the Intelligence tab, not yet unified with the compact
summary; and there's no resume-review UI for an `InboxEntry` whose
extraction proposal was left unapproved after navigating away — the
review flow happens inline, immediately after pasting, same as every
paste-box instance in this round.

**Not yet verified in a live signed-in browser** — same standing caveat
as Phase 0 and every route built since. `npx tsc --noEmit`, `eslint`,
`vitest` (139 tests, unchanged — Phase 1 is CRUD/routes/UI, not new pure
engines, so no new unit-test surface), and `next build` (all new routes
registered correctly) all pass.

### Phase 2 — the orchestration layer

Built in the doc's own dependency order (§11):

1. **Tool-calling in the AI router** (§5.4) — `src/lib/ai/providers/types.ts`
   gained `ToolDefinition`/`ToolCall`/`AiToolTurnRequest`/`AiToolTurnResult`
   types and an `AiToolCallingAdapter` interface, implemented separately per
   provider since DeepSeek's OpenAI-compatible `tools`/`tool_calls` shape
   and Gemini's own `functionDeclarations`/`functionCall`/
   `functionResponse` shape are genuinely different, not a shared
   abstraction. `router.ts`'s new `pickToolAdapter()` picks the first
   configured provider — unlike the plain-completion router, a
   tool-calling exchange can't fall back mid-conversation once started
   (the two providers' message formats aren't interchangeable). Neither
   adapter's tool-calling path is verified against a live call — no API
   key in this dev environment, same standing caveat as every AI
   integration in this project.
2. **The AI Orchestrator** (§8.1, `src/lib/ai/orchestrator.ts`) — the
   first genuinely agentic component in this codebase. A bounded,
   at-most-2-round exchange: one round the model may call tools, one
   forced-final round with tools withheld so a misbehaving model can't
   loop forever. An 11-tool fixed registry (`create_task`, `update_task`,
   `complete_task`, `create_prospect`, `update_prospect`,
   `create_decision`, `supersede_decision`, `request_ai_employee_report`,
   `flag_stale_information`, `generate_daily_brief`,
   `generate_pipeline_report`) — a hand-written dict keyed by name, never
   dynamic dispatch off an LLM-supplied string.
3. **Approval/autonomy levels** (§8.2) — folded directly into the
   registry rather than a separate mechanism, since each tool's level is
   fixed metadata on its own entry. **Every write-capable tool defaults
   to Level 0** ("propose, Winston approves") — matching the
   architecture doc's own explicit default, "everything in Phase 2 until
   proven safe," not just Level 1's narrower "notes/timestamps" carve-out.
   Calling a write tool never touches Firestore; it returns a structured
   proposal (tool name + args + a human-readable description) the
   Command Center renders as an Approve card, which — when clicked —
   calls the exact same existing CRUD routes every other UI in this
   project already uses (`POST /api/admin/crm/tasks`,
   `PATCH .../prospects/[id]`, etc.) — no new "apply an orchestrator
   proposal" route needed, mirroring the AI Inbox's own propose-then-apply
   pattern. The three read-only tools (`flag_stale_information` — a
   single-prospect staleness check that does write `AuditEvent`s, closer
   in spirit to Level 1's "activity logs" category; `generate_daily_brief`;
   `generate_pipeline_report`) execute immediately since they mutate
   nothing else. One hard floor regardless of any future level change:
   an `update_prospect` proposal carrying a stage of 5+ ("Qualified
   Opportunity" or later) is never one-click-approvable in the Command
   Center UI — it's shown as "review directly on the prospect page"
   instead, matching §8.2's own Level 4 ("stage changes past Qualified…
   Always — never auto-approved").
4. **System State** (§8.3, `src/lib/ai/systemState.ts`) — not a new
   Firestore collection, a computed-and-cached summary: the active
   campaign's live scoreboard, today's attempts/meaningful vs. target,
   overdue-prospect count, a heuristic "biggest bottleneck" (behind-pace
   attempts, else overdue prospects, else none), the top prospect by
   `opportunityScore`, and the most common `riskFlag` across active
   prospects. **One disclosed deviation from the doc's literal wording**:
   cached with a flat 15-minute TTL rather than event-driven invalidation
   on "the same triggers as GLOBAL_CONTEXT" — computing it already joins
   three collections, and wiring surgical invalidation into every one of
   those write paths for a summary that's read, not acted on precisely,
   was judged not worth the complexity here.
5. **The AI Command Center** (§8.4) — `/admin` evolves, not a new route,
   exactly as specified. Rather than replace the existing Overview page's
   real pageview/lead stats (Visitor Intelligence 2.0 data, still useful,
   nothing in the doc says to remove it), the new `CommandCenter.tsx`
   renders **above** those stats: four tiles (attempts today vs. target,
   prospects needing attention, overdue next actions, AI workforce
   awaiting a report — the last computed by joining the employee list
   against the AI Inbox's own entries, flagging anyone active with no
   entry in 7+ days), a bottleneck banner when one's flagged, a top-3
   actions list (deterministic, built from the same data — no AI call for
   arithmetic), and the "what should I do right now?" prompt box calling
   the Orchestrator directly, rendering its answer, a tool-call
   transparency log, and any proposal Approve cards inline.
6. **System-wide activity feed** (§8.5, `/admin/activity`) — a flat,
   actor-filterable, chronological read of `AuditEvent`, the collection
   every prior phase has already been writing to since Phase 1.

**The Gemini-style chat composer, at explicit user request**
(`src/components/admin/ChatInput.tsx`) — a shared input used by both the
Command Center's prompt box and (retrofitted) the AI Inbox's paste box:
auto-grows with content via a `scrollHeight`-driven `useLayoutEffect` up
to a max, then scrolls internally; settles into a compact, fully-rounded
"minimized" pill when idle and empty, expanding back to the full
multi-line composer on focus (a spring-animated `border-radius` via
`framer-motion`, already a project dependency) — which on a touchscreen
*is* the focus event, so "expand on touch" needs no separate touch
handling. Enter submits, Shift+Enter inserts a newline, matching the
chat-app convention the request referenced.

**Not yet verified in a live signed-in browser** — same standing
caveat as every phase before it, and the highest-priority thing to
click-test first given this phase's size: the chat composer's
grow/collapse feel is exactly the kind of interaction that reads
differently on a screen than in code, and the Orchestrator's tool-calling
path has zero live-provider verification behind it (no API key in this
dev environment). `npx tsc --noEmit`, `eslint`, `vitest` (139 tests,
unchanged — Phase 2 is also CRUD/routes/UI plus provider-integration
code, not new pure calculation engines), and `next build` (all new
routes registered correctly) all pass.

**Genuinely still open, not blocking:** Phase 3 (the anti-procrastination
engine — morning brief, midday nudge, end-of-day review, procrastination-
pattern detection), which the doc itself gates on the Orchestrator and
System State being in real daily use first; flipping any tool above
autonomy Level 0 once it's been observed being proposed correctly for a
while; and the `emailSends` collection / 20-per-day cap / actual send
route from the EmailJS setup below, which is account/template-ready but
not wired to a send button yet.

### Phase 3 — the anti-procrastination engine

Per doc §9, correctly sequenced last since it needs Phase 2's System
State and Orchestrator to already know what "on track" and "behind"
mean. All three touchpoints are inline on the Command Center
(`src/components/admin/DailyRhythm.tsx`, rendered above the tiles) —
never a notification, since no delivery channel exists (§12) — and
deliberately not modal: closing the tab is always possible, but each
piece re-appears on the next Command Center load that same day until
dismissed/completed, matching this system's own "pushy, not
unaccountable" design goal from the original brief.

- **Morning brief** — on the first Command Center load of the calendar
  day, fires a real Orchestrator turn (`POST
  /api/admin/crm/orchestrator/ask` with a fixed prompt asking it to use
  `generate_daily_brief`) and shows the answer in a violet-accented
  (AI-content convention) card. Falls back to a deterministic one-liner
  built from System State if the AI call fails — never blocked by an AI
  failure, same discipline as every AI feature in this project.
  Dismissible; won't re-fire again until the next calendar day
  (`useDailyRhythm.ts`, per-browser via `localStorage`, the same
  `useSyncExternalStore` pattern as `useDemoUnlocked`/`useSelectedCountry`).
- **Midday nudge** — a **deterministic** check, not an AI call: after
  12:00 (browser-local time) with today's attempts still under half the
  daily target, a dismissible banner. **One disclosed deviation from the
  doc's literal wording**: §9 describes this as "time spent in
  non-outbound activity today vs. outbound target," but this system has
  no time-tracking/activity-telemetry mechanism anywhere — the doc's own
  §12 lists this as a real, separate gap. Implemented instead as
  attempts-logged-vs-target-by-this-hour, the closest honest proxy
  actually buildable from data this system has.
- **End-of-day review** — after 17:00, a card showing today's target vs.
  actual, plus every task due today or earlier that's still open/
  in-progress, each needing a reason before the review can be marked
  complete: `no-answer`/`bad-data`/`blocked`/`forgot`/`low-priority`/
  `avoided`/`other` (a new `TaskIncompleteReason` field directly on
  `Task`, not a new Fact-like construct — the simpler of the two options
  the doc itself left open, and the one that fits this codebase's
  existing shapes without inventing a "scoped to Winston himself" special
  case). "Forced" means the **Complete review** button stays disabled
  until every listed task is classified, not that the page traps you —
  if there's nothing incomplete, one tap marks it reviewed.

**Procrastination-pattern detection** (the doc's own fourth Phase 3
item) is explicitly **not built** — the doc itself says it "needs weeks
of [end-of-day classification] data to have anything to learn from" and
is "not scoped further in this document." Nothing to build yet; the
classification data above is what a future pass would mine.

No new API routes this phase — the morning brief reuses the existing
Orchestrator endpoint with a fixed prompt, the midday nudge is pure
client-side arithmetic over already-fetched System State, and the
end-of-day review reuses the existing task list/update routes.

**Not yet verified in a live signed-in browser** — same standing
caveat as every phase before it, and this one in particular needs a
real clock: the three touchpoints only render past specific hours
(12:00/17:00) and only once per calendar day per browser, none of which
this dev environment can exercise end-to-end. `npx tsc --noEmit`,
`eslint`, `vitest` (139 tests, unchanged), and `next build` all pass.

### EmailJS — outbound email, send button built

[`docs/email-templates.md`](docs/email-templates.md) has the full setup
(env vars, the two template contents to paste into the EmailJS
dashboard) and the send feature's own writeup. Short version: every
prospect page (`/admin/prospects/[id]`, Overview tab) has a
`SendEmailPanel` — pick Cold Outreach or Follow-up, send — and the Today
tab links each prospect with an email on file straight to it.
`POST /api/admin/crm/email/send` does everything in one request: checks
the 20/day cap (`countEmailSendsToday()` in `crm.ts`, counting only
successful sends so a transient EmailJS outage doesn't cost part of the
day's allowance), calls EmailJS, and on success logs an `Interaction`
(type `email`, so `lastContactDate` updates like any other real touch)
and an `email_sent` `AuditEvent`. Every attempt — sent or failed — is
recorded in a new `emailSends` collection.

**One deliberate deviation from the architecture doc's own literal
wording** ("a route wrapping EmailJS's *client* SDK"): the send call
itself happens **server-side**
(`src/lib/email/emailjs.ts`, plain `fetch` to EmailJS's REST endpoint),
not via their browser SDK. EmailJS's send endpoint is just an HTTP POST
— nothing about it requires a browser — and doing it server-side is
what makes the 20/day cap a *real* limit rather than a client-trusted
one: if the browser held the public key and made the EmailJS call
itself, a modified client could call EmailJS directly and skip this
app's cap check entirely. This needs one more secret beyond the four
`NEXT_PUBLIC_` values already documented — `EMAILJS_PRIVATE_KEY`
(EmailJS Account → Security), required as an `accessToken` so EmailJS
accepts a send call that isn't coming from a browser it recognizes.
Also new: optional `EMAIL_SENDER_NAME`/`EMAIL_SENDER_ROLE`/
`EMAIL_REPLY_TO` env vars for the templates' own signature merge tags,
defaulting to "Winston"/"DeployFleet" if unset.

**Genuinely still open:** the 20/day cap resets at UTC midnight, not
Zambia local midnight (~2h off from CAT) — disclosed, not worth
timezone-aware date math for a personal daily cap; no campaign-level
send-reporting UI yet, though `EmailSend` rows do carry `campaignId`;
and no unsubscribe/opt-out mechanism, appropriate at this tool's actual
scale (20/day, personal outreach) but worth adding before that changes.

### WhatsApp Intelligence & Outreach Automation — Phase 4, all five sub-phases (WA-0–WA-4) built

[`docs/whatsapp-intelligence-architecture.md`](docs/whatsapp-intelligence-architecture.md)
is the full architecture document, grounded in an actual read of
Winston's own Zuri product (`creativesites/Personal-Assistant`)'s
production WhatsApp/conversation-intelligence stack (Baileys transport,
session management, message pipeline, AI analysis) — what's directly
portable, what needs adapting, and what's genuinely new engineering are
each traced to real source files read during that session, not assumed.
Per Winston's explicit "implement all phases in a single session...for
any open questions, implement your recommendations," every one of the
doc's §15 open questions now carries a concrete resolution and every
phase is built:

- **WA-0 (gateway skeleton)**: `whatsapp-service/` — a new, separate,
  host-agnostic Node service (ported/simplified from Zuri's
  `WhatsAppTransport`/`BaileysTransport`/`SessionManager`, single-session
  rather than Zuri's multi-tenant one), exposing `/status`, `/connect`,
  `/messages/send`, `/whatsapp/check`, and forwarding inbound messages to
  DeployFleet's own webhook. Verified via `npm run typecheck`/
  `npm run build` against real `@whiskeysockets/baileys` types.
- **WA-1 (number intelligence)**: `Prospect.whatsappStatus`/
  `whatsappVerifiedAt`/`whatsappJid`, a new `ProspectContact` collection
  for multi-number prospects (`POST /api/admin/crm/whatsapp/verify`,
  `ProspectContacts.tsx`), on-demand-only verification per §15's
  resolved rate-limit-safety call.
- **WA-2 (inbound as CRM activity)**: `POST /api/whatsapp/webhook`
  (bearer-secret authenticated, not a Clerk session — the gateway calls
  it, not a browser) identifies the prospect, stores the message, runs
  `WHATSAPP_ANALYSIS_SYSTEM_PROMPT` for sentiment/urgency/buying signals
  (written directly, no approval gate — the same "score from an always-
  on field" lesson Zuri's own lead-scoring history taught), and
  separately reuses the AI Inbox's exact review-then-apply mechanism
  (factored out as `src/lib/ai/inboxExtraction.ts`, shared with
  `POST /api/admin/crm/inbox`) for any facts/tasks/decisions — never a
  second write path.
- **WA-3 (controlled outbound)**: `WhatsAppSend` (capped at 20/day,
  24h per-prospect cooldown, permanent opt-out enforcement — same shape
  as `EmailSend`), `POST /api/admin/crm/whatsapp/send` (Level 0,
  permanently — the only route that ever calls the gateway's send
  endpoint), `POST /api/admin/crm/whatsapp/draft` (AI-drafts, never
  sends), and `SendWhatsAppPanel.tsx` on the Prospect page.
- **WA-4 (AI Marketing OS integration)**: three new Orchestrator tools
  (`draft_whatsapp_message`, `send_whatsapp_message` — both "propose"
  only, Command Center never one-click-approves a WhatsApp send, it
  links to the prospect page instead; `verify_whatsapp_number` — a real
  "read" tool), a Command Center tile ("WhatsApp conversations awaiting
  response"), a System State bottleneck check (Winston's own §12
  morning-brief example: a verified-WhatsApp, high-opportunity prospect
  with zero outreach), and Daily Rhythm's brief now includes the
  WhatsApp-awaiting-response count.

**Two things remain genuinely impossible to complete from inside this
repo/dev environment**, disclosed exactly where they'd otherwise be
assumed done: establishing a live Baileys↔WhatsApp connection (needs a
real phone to scan a QR code or enter a pairing code) and actually
deploying `whatsapp-service` to live hosting (needs hosting-provider
credentials). Every DeployFleet-side feature is written to degrade
gracefully — "gateway not configured" — exactly like `isEmailJsConfigured()`
already does for EmailJS, until Winston completes both manual steps
(`whatsapp-service/README.md` has the full checklist). **Not yet
verified against a live WhatsApp account or a live gateway deployment**
— same "implemented to the documented API shape, not live-verified"
caveat this project has carried consistently through its DeepSeek/
Gemini/EmailJS integrations.

**Follow-up round, at explicit user direction, closing two real gaps in
the first pass.** (1) **The connect flow is now ported from Zuri as
closely as this single-session scope allows, not simplified** —
`whatsapp-service/src/transport/baileys.ts` was rewritten against a
fresh, full read of Zuri's own `transport/baileys.ts`/
`lib/session-manager.ts`, since the first pass had quietly dropped
several pieces of hard-won connection logic: the exact `makeWASocket`
config (`fetchLatestBaileysVersion()` with a cached fallback,
`Browsers.ubuntu('Chrome')`, `syncFullHistory: true`), a stale-socket
event guard (`if (sock !== this.sock) return` on every listener — without
it, a dead socket's late-firing events can corrupt the live one's
state), a `WriteQueue` serializing `creds.update` writes (concurrent
writes can otherwise corrupt the auth-state file), a 3-minute QR-scan
timeout, and — the one genuinely new capability added, since the first
pass had no pairing-code support at all — the full phone-number pairing
flow (`POST /connect` with `{ phone }`, a 3-second post-handshake delay,
up to 3 retries with backoff, and WhatsApp's exact `XXXX-XXXX` code
formatting). The disconnect-reason handling is also now exact:
`restartRequired` reconnects immediately (500ms) rather than backing off,
`badSession` retries up to 3 times before purging auth state (the first
pass treated it as immediately terminal), and `loggedOut`/
`connectionReplaced` are still terminal. (2) **A WhatsApp Inbox** (`/admin/whatsapp`,
`WhatsAppInboxTab.tsx`) — a conversation-list/message-thread/composer
layout adapted from Zuri's own `apps/web/.../inbox/` (day dividers,
WhatsApp-style bubble colors, auto-scroll, Enter-to-send via the
existing `ChatInput` component), stripped of everything Zuri-specific
DeployFleet doesn't need (Status/stories, voice notes, group chat,
document/quote-suggestion cards, the AI relationship-intelligence side
panel, real-time Socket.IO — this polls instead, like every other
live-ish view in this dashboard). **Structurally, not just by filtering,
this only ever shows prospects already in DeployFleet's system**: a
`WhatsAppConversation` row is only ever created by `getOrCreateConversation()`
after `findProspectByPhone()` matches a real prospect (send route or
inbound webhook) — there is no code path that creates one for an
unrecognized number, so the Inbox's conversation list needs no filtering
logic of its own to enforce that. Building it surfaced and fixed a real
correctness gap in the first pass: the 24h per-prospect send cooldown
(§11, meant to stop repeated unanswered cold-outreach pings) would have
also blocked replying to a prospect who'd just messaged back — fixed
with a carve-out in `POST .../whatsapp/send` (skip the cooldown when the
conversation's most recent message is an inbound one newer than
Winston's last send), and the conversation state a send transitions to
now distinguishes first outreach (`outreach_sent`) from a reply
(`awaiting_response`) instead of collapsing both into one state.
Verified: `tsc`/`eslint`/`vitest`/`next build` all pass clean on the main
app; `whatsapp-service`'s own `tsc`/`npm run build` pass clean. **Still
not live-verified** — same standing caveat.

**Two real production bugs fixed in a later session**, both root-caused
against the live demo deploy: (1) the WhatsApp status/verify gateway
client (`gatewayClient.ts`) was discarding the gateway's own error
`reason` on any non-2xx response and substituting a generic `http_503`
— so a genuinely unreachable gateway and a gateway reporting "no session
linked" rendered identically as "Couldn't complete this action," which
is exactly why "still shows Connect" and "Verify number isn't working"
were undiagnosable from the UI. Fixed by parsing the error body and
surfacing its real `reason`, and by giving `WhatsAppConnectPanel`/
`SendWhatsAppPanel` a distinct "can't reach the gateway" state, separate
from "gateway says disconnected." (2) EmailJS's "The recipients address
is empty" — not a code bug (this app has always sent a correct
`to_email` value); the templates' own EmailJS-dashboard Settings → "To
Email" field was never pointed at `{{to_email}}`. Documented as the
critical, easy-to-miss step in `docs/email-templates.md`. The same
session also shipped a third, fully-editable **Custom** email template
with AI Draft/Revise (`POST /api/admin/crm/email/draft`, same Level-0
"always a proposal, never auto-sent" discipline as WhatsApp's own AI
draft) — see `docs/email-templates.md` §2's Template 3.

The fuller vision for both channels — a real Email Center workspace
(WhatsApp already has one), a unified chat timeline with AI-extracted
facts/tasks/decisions rendered inline, and tone-variant messaging — is
planned, not yet built, in
[`docs/email-whatsapp-command-center-architecture.md`](docs/email-whatsapp-command-center-architecture.md),
which also elaborates
[`docs/revenue-os-architecture.md`](docs/revenue-os-architecture.md)
§5.12/§5.13. `docs/revenue-os-architecture.md` itself is a separate,
larger planning document (not yet implemented) for evolving `/admin/today`
into a full command-center workday loop — Directives, AI team briefings,
a deterministic prospect-ranking engine, and more — written the same
research-before-code way as every architecture doc in this list.

### Admin dashboard (`/admin`)

**Redesigned as a sidebar-navigated app, not a single route with
client-side tabs** — at explicit user direction ("Vercel like ... not
tabs ... mobile first"). Every former tab is now a real route under
`/admin/*` (`/admin`, `/admin/today`, `/admin/prospects` (plus its
dynamic `/admin/prospects/[id]` Prospect Intelligence page),
`/admin/pipeline`, `/admin/targets`, `/admin/outreach`, `/admin/team`
(plus `/admin/team/[id]`), `/admin/inbox`, `/admin/decisions`,
`/admin/leads`, `/admin/visitors`, `/admin/geography`, `/admin/content`,
`/admin/campaigns`, `/admin/realtime`, `/admin/insights`,
`/admin/diesel-prices`) — the URL
now reflects what's on screen (bookmarkable, shareable, correct
back-button behavior), which a single route with `useState` tab
selection could never do. `src/app/admin/layout.tsx` does the two-gate
auth check once for all of them (previously only `/admin/page.tsx` did
it, back when it was the only route); `src/components/admin/AdminShell.tsx`
is the actual chrome — a persistent left sidebar grouped into
Analytics/Marketing/Intelligence/Settings on desktop (`md:` and up), a
slim top bar with a hamburger opening a full slide-in drawer with the
same nav below that, closing automatically on route change (covers
browser back/forward, not just link clicks). `AdminDashboard.tsx` (the
old tab switcher) and its client-state tab list are gone entirely, not
kept alongside the new shell.

**Auth is Clerk, not the old shared-password HMAC-cookie gate** — the
migration this project's own code comments had been flagging as planned
since the diesel-price editor first shipped. Two independent, both-
required gates, checked server-side in `src/app/admin/layout.tsx` before
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

**Nineteen routes**, grouped in the sidebar as CRM / Analytics / Marketing /
Intelligence / Settings, each a thin `page.tsx` (in `src/app/admin/*`)
around a client Tab component (in `src/components/admin/`) that does the
actual data fetching. CRM leads the group order — DeployFleet's own
sales pipeline is the actual operational reason this dashboard exists,
ahead of the website-visitor analytics below it.

**CRM (DeployFleet's own team, not website visitors — see the section
above):**
- **Today** (`/admin/today`) — Winston's daily queue.
- **Prospects** (`/admin/prospects`) — the full pipeline, browse/seed/sync/
  add; each prospect links to its own `/admin/prospects/[id]` Prospect
  Intelligence page.
- **Pipeline** (`/admin/pipeline`) — the Kanban stage board.
- **Targets** (`/admin/targets`) — the weekly attempts/meaningful-
  interactions scoreboard.
- **Outreach** (`/admin/outreach`) — campaign creation, prospect
  assignment, per-campaign scoreboard.
- **Team** (`/admin/team`) — the AI Workforce list; each employee links
  to `/admin/team/[id]`.
- **AI Inbox** (`/admin/inbox`) — "paste everything" — see the
  AI-native Marketing OS section above.
- **Decisions** (`/admin/decisions`) — the Decision Ledger.
- **Activity** (`/admin/activity`) — the system-wide `AuditEvent` feed.

**Analytics:**
- **Overview** (`/admin`) — pageview counts (all-time, last 7/30 days,
  unique visitors via a locally-generated `localStorage` id), leads-by-
  pipeline-status counts, and a top-10-pages table. `/api/admin/stats`
  computes this with Firestore's own `.count()` aggregation queries for
  the cheap totals and a single bounded (5,000-doc) fetch of the last 30
  days' pageviews for the detail that needs raw docs.
- **Leads** (`/admin/leads`) — every lead from all 3 sources, filterable
  by source, each with a real pipeline-status dropdown that `PATCH`es
  `/api/admin/leads`.
- **Visitors** (`/admin/visitors`) — the Visitor Intelligence 2.0
  pipeline's dashboard surface: a filterable visitor list with
  engagement/intent score badges, an expand-to-load full profile, and
  the legacy-pageviews backfill trigger.
- **Geography** (`/admin/geography`) — the Phase 3 country/city
  breakdown: a Today/7d/30d/90d/All-time range selector, an expandable
  country table, no map yet.

**Marketing (Phase 4, new this round):**
- **Content** (`/admin/content`) — `getContentPerformance()` in
  `visitorIntelligence.ts` joins three separate bounded fetches
  (`page_view` events, sessions, conversion events) by page path in
  memory: views, unique visitors, bounce rate, average engagement as a
  landing page, conversions, conversion rate. Deterministic
  classification badges (Traffic Winner / Engagement Winner / Conversion
  Winner / High Bounce / "Hidden gem" for low-traffic-high-conversion
  pages) — no "SEO Opportunity" label, since that needs every event to
  carry its session's referrer type, which only sessions do today.
- **Campaigns** (`/admin/campaigns`) — `getCampaignPerformance()` groups
  sessions by channel (`utmSource — utmCampaign`, or the referrer type
  when there's no campaign), joined to real conversion events via each
  event's own `sessionId`. A funnel bar chart above it
  (`getFunnelSummary()`): total visitors → had a session → engaged
  (score ≥ 40) → converted (fired any real conversion event) → became a
  lead — this site's own vocabulary, not the DeployFleet CRM's pipeline
  stages, since a marketing site has no sales pipeline of its own.

**Intelligence (Phase 5, new this round):**
- **Real-Time** (`/admin/realtime`) — visitors active in the last 5
  minutes, polled client-side every 15s (no websocket/SSE — this
  serverless Next.js + Firestore stack has no persistent-connection
  infra to push through), with a manual refresh button and an honest
  "polls every 15s, not a live push feed" label rather than pretending
  otherwise.
- **Insights** (`/admin/insights`) — two halves. A deterministic alerts
  feed (`getAlerts()`: high-intent visitors in the last 24h, visitors who
  returned 3+ times, pricing-page views today, conversions today) —
  computed fresh on every page load, **not delivered anywhere** (no
  email/Slack/webhook; that needs a job scheduler and a notification
  channel this project doesn't have — Vercel Cron could drive a future
  digest, deliberately not built speculatively here). And an on-demand
  "Generate Insight" button (`/api/admin/analytics/ai-insight`) that
  hands an aggregated, already-anonymous summary (funnel counts, top
  channels/pages/countries — no visitor ids, names, or contact info) to
  the same DeepSeek/Gemini router every calculator's "AI Insight" panel
  already uses, via a new `MARKETING_INSIGHT_SYSTEM_PROMPT` in
  `src/lib/ai/prompts.ts`. Manual trigger only, same AI-spend discipline
  as everywhere else in this project.

**Settings:**
- **Diesel Prices** (`/admin/diesel-prices`) — unchanged from before:
  same `adminStore.ts` A-to-C Upstash bridge, same UI, `PUT
  /api/diesel-price` still gated by `requireAdmin()`.

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
credentials only you can generate. **The sidebar/drawer redesign is
verified for routing and auth-gating only** (`curl` against every new
`/admin/*` route confirms `src/proxy.ts`'s Clerk gate covers all of them,
returning a 307 redirect exactly like the original single `/admin`
route did) — the actual sidebar/drawer chrome, mobile breakpoint
behavior, and the new Content/Campaigns/Real-Time/Insights pages'
rendering have **not** been checked in a real, signed-in browser
session, since Clerk sign-in isn't something this dev environment can
complete without real credentials (same standing limitation as the
Firestore-write caveat above). Worth a real click-test on a phone before
considering this fully done.

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
