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
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Resources", href: "/resources" },
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
    { label: "Book a Demo", href: "/demo" },
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
