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

## Content status

The full site structure (nav, footer, homepage, and all `/product/*`,
`/solutions`, `/pricing`, `/about`, `/resources`, `/demo`, `/contact`
routes) is built and passes `next build`. What's still placeholder, by
design, until real assets/decisions land:

- **Screenshots** — every product screenshot is a labeled dashed-border
  placeholder (`ScreenshotPlaceholder` component). The label text names the
  exact screen expected (e.g. "Mission Control — home dashboard"). Drop the
  real PNG into `public/screenshots/` and swap in an `<Image>` — the label
  doubles as a shot list.
- **WhatsApp number** — `WHATSAPP_NUMBER` in `src/lib/nav.ts` is a
  placeholder (`260000000000`). Replace with the real number before launch;
  every WhatsApp CTA and both lead forms depend on it.
- **Pricing** — no fixed numbers exist yet (open question in the product's
  own architecture docs). The pricing page intentionally shows tiers by
  what's included, not by price, funneling to a conversation instead.
- **Lead capture** — both forms (`DemoForm`, the homepage `CtaSection`)
  submit by opening a pre-filled WhatsApp chat client-side. No backend/CRM
  integration exists yet; that's a deliberate MVP choice (WhatsApp is the
  channel this audience actually uses), not an oversight — worth revisiting
  once there's a CRM to route leads into.

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
- Certified/live tax-authority (ZRA) integration — the module exists in
  code but hasn't been verified against the real sandbox.
- Guaranteed offline support in the field — architecturally intended, not
  confirmed tested.

Also avoid: "Odoo," "ERP," and generic SaaS filler ("seamless,"
"revolutionize," "cutting-edge"). DeployFleet's own product docs are
explicit that it should never read as an ERP with trucking fields bolted
on — the same applies here.

## Deployment

Deploys to Vercel. No environment variables are required for the current
build (no backend/API keys wired in yet).
