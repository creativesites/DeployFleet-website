@AGENTS.md

# CLAUDE.md — DeployFleet Website

Marketing site for DeployFleet ("Mission Control for African Trucking").
Next.js + Tailwind, deployed on Vercel. Standalone repo — never a
dependency of, or dependent on, the Odoo application repo
(`creativesites/DeployFleet`).

Full conventions, brand token table, content status, and messaging
guardrails live in [README.md](README.md) — read it before making changes.
The short version:

- **Brand tokens only, never hardcoded hex.** All colors/spacing are
  `--df-*` CSS custom properties in `src/app/globals.css`, mapped into
  Tailwind's `@theme`. Violet (`--df-ai-violet`) is reserved for AI-related
  content exclusively, matching the product's own convention.
- **Screenshots are placeholders by design** (`ScreenshotPlaceholder`
  component) until real product screenshots land in `public/screenshots/`
  — the label text is the shot list.
- **Don't overclaim.** README.md has a specific list of claims to avoid
  until the product team confirms them (AI prediction accuracy, ZRA
  integration, offline mobile support, a driver mobile app). When in doubt,
  check `creativesites/DeployFleet`'s own `docs/architecture/` before
  writing copy that implies a capability — that repo is the source of truth
  for what's actually built.
- **Never say "Odoo" or "ERP" anywhere on the site.** The product is built
  on Odoo but never positioned that way publicly.
- Verify changes with `npm run build` (type-checks + prerenders every
  route) before considering a page done, and click through it — a
  `next build` pass is not the same as a real visual check.
