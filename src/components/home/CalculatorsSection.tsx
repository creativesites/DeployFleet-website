import Link from "next/link";
import type { ReactNode } from "react";
import { intelligenceHubCalculators } from "@/lib/nav";

/**
 * A curated 6-of-10 subset spanning cost, revenue, HR, asset, compliance,
 * and software-ROI — not the first 6 in the array, which cluster too
 * heavily on Phase A/B cost calculators. intelligenceHubCalculators in
 * nav.ts stays the single source of truth for label/href/description;
 * this only adds the icon and picks which ones get homepage real estate.
 */
const featured: { href: string; icon: ReactNode }[] = [
  {
    href: "/intelligence-hub/cost-per-km",
    icon: (
      <path
        d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.14-6.14l-2.12 2.12M8.98 15.02l-2.12 2.12m0-10.28l2.12 2.12m8.04 8.04l-2.12-2.12M12 8a4 4 0 100 8 4 4 0 000-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/intelligence-hub/trip-profitability",
    icon: (
      <path
        d="M4 19h16M7 15l3-4 3 2 4-6M7 15v4M13 13v6M17 7v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/intelligence-hub/driver-pay",
    icon: (
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-3.87 3.13-7 7-7s7 3.13 7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/intelligence-hub/fleet-tco",
    icon: (
      <path
        d="M3 13l1.5-5A2 2 0 016.4 6.5h7.2a2 2 0 011.9 1.5L17 13m-14 0v5a1 1 0 001 1h1m12-6v5a1 1 0 01-1 1h-1m-10 0a2 2 0 104 0m6 0a2 2 0 104 0M3 13h14m3 0h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/intelligence-hub/compliance-risk",
    icon: (
      <path
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/intelligence-hub/roi-payback",
    icon: (
      <path
        d="M4 4v16h16M8 16l3-4 3 3 5-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function CalculatorsSection() {
  const cards = featured
    .map((f) => ({
      ...f,
      calc: intelligenceHubCalculators.find((c) => c.href === f.href),
    }))
    .filter((c) => c.calc);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow justify-center">Free, no sign-up</span>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
          Run the numbers on your own fleet first.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-body">
          10 free calculators — real deterministic math, the same engine
          DeployFleet runs on. No account, no email, no gated result.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, icon, calc }) => (
          <Link key={href} href={href} className="df-tilt-card card-surface p-6">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-df-md"
              style={{
                background: "color-mix(in srgb, var(--df-teal) 10%, transparent)",
                color: "var(--df-teal)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {icon}
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-navy">{calc!.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{calc!.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">
              Open calculator
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/intelligence-hub" className="btn-primary">
          Explore all 10 calculators
        </Link>
      </div>
    </section>
  );
}
