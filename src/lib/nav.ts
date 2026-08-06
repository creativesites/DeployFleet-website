export type NavLink = {
  label: string;
  href: string;
  description?: string;
};

export const productLinks: NavLink[] = [
  {
    label: "Dispatch & Operations",
    href: "/product/dispatch",
    description: "Match loads to drivers and trucks in seconds, not phone calls.",
  },
  {
    label: "Fleet & Maintenance",
    href: "/product/fleet-maintenance",
    description: "One view per truck: trips, service, tyres, fuel, insurance.",
  },
  {
    label: "Compliance & Safety",
    href: "/product/compliance",
    description: "Expired documents block dispatch automatically, not after the fact.",
  },
  {
    label: "Billing & Customers",
    href: "/product/billing",
    description: "Invoices generated from completed trips, not spreadsheets.",
  },
  {
    label: "AI Copilot",
    href: "/product/ai-copilot",
    description: "An operations assistant that suggests — you always decide.",
  },
];

export const primaryNav: NavLink[] = [
  { label: "Product", href: "/product" },
  { label: "Solutions", href: "/solutions" },
  { label: "Intelligence Hub", href: "/intelligence-hub" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Resources", href: "/resources" },
];

export type CalculatorPhase = "A" | "B" | "C" | "D";

export type CalculatorLink = NavLink & {
  phase: CalculatorPhase;
  live: boolean;
};

/**
 * Full portfolio per the Intelligence Hub plan §05, phased A→D. `live`
 * flips to true as each one ships — the index page and cross-links read
 * from this single list so nothing has to be updated in two places.
 */
export const intelligenceHubCalculators: CalculatorLink[] = [
  {
    label: "Cost Per Kilometre",
    href: "/intelligence-hub/cost-per-km",
    description: "The flagship number: what it really costs you to run a truck, per kilometre.",
    phase: "A",
    live: true,
  },
  {
    label: "Trip Profitability",
    href: "/intelligence-hub/trip-profitability",
    description: "Per-trip profit, margin, and the minimum rate that's worth accepting.",
    phase: "A",
    live: true,
  },
  {
    label: "Fuel Cost & Efficiency",
    href: "/intelligence-hub/fuel-efficiency",
    description: "Expected vs. actual fuel consumption, and when the gap is worth investigating.",
    phase: "A",
    live: true,
  },
  {
    label: "Driver Pay & Advance",
    href: "/intelligence-hub/driver-pay",
    description: "Net pay, advance balances, and statutory deductions, worked out correctly.",
    phase: "B",
    live: false,
  },
  {
    label: "Fleet Total Cost of Ownership",
    href: "/intelligence-hub/fleet-tco",
    description: "Lifecycle cost per truck, and the year replacing it actually pays off.",
    phase: "B",
    live: false,
  },
  {
    label: "Break-Even Utilisation",
    href: "/intelligence-hub/break-even",
    description: "How many trucks need to be moving, and how far, before you're profitable.",
    phase: "B",
    live: false,
  },
  {
    label: "Compliance & Penalty Risk",
    href: "/intelligence-hub/compliance-risk",
    description: "What non-compliance is likely to cost, and what's due soon.",
    phase: "C",
    live: false,
  },
  {
    label: "Tyre Cost Per Kilometre",
    href: "/intelligence-hub/tyre-cost",
    description: "Budget vs. premium tyres, compared on total cost, not sticker price.",
    phase: "C",
    live: false,
  },
  {
    label: "Load Optimisation & Axle Weight",
    href: "/intelligence-hub/load-optimisation",
    description: "Weight distribution across multi-country axle regulations.",
    phase: "D",
    live: false,
  },
  {
    label: "DeployFleet ROI & Payback",
    href: "/intelligence-hub/roi-payback",
    description: "Whether — and how fast — fleet software pays for itself for your fleet.",
    phase: "D",
    live: false,
  },
];

export const footerNav = {
  product: productLinks,
  company: [
    { label: "About", href: "/about" },
    { label: "Solutions", href: "/solutions" },
    { label: "Pricing", href: "/pricing" },
    { label: "Resources", href: "/resources" },
  ] as NavLink[],
  get: [
    { label: "View Demo", href: "/demo" },
    { label: "Contact", href: "/contact" },
  ] as NavLink[],
};

// TODO(lead-capture backend): once a backend exists to collect and store
// leads, gate this behind the /demo form — collect name/company/phone
// first, THEN redirect here (or to a personalized one-click login link),
// instead of linking straight to the shared live demo like this. See
// README.md "Planned: gated demo access" for the full plan.
export const LIVE_DEMO_URL = "http://199.192.23.46:4169/odoo";

export const WHATSAPP_NUMBER = "260979046745";
export const WHATSAPP_MESSAGE = "Hi DeployFleet, I'd like to know more about the platform.";
export const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`;
