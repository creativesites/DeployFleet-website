import type { Metadata } from "next";
import Link from "next/link";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DeployFleet is priced around the size and shape of your fleet — talk to us for a plan built around how you actually operate.",
};

const tiers = [
  {
    name: "Starter",
    body: "For a single-depot fleet getting off paper and WhatsApp.",
    points: ["Dispatch & driver management", "Compliance-gated assignment", "Core fleet & maintenance tracking"],
  },
  {
    name: "Growth",
    body: "For a fleet ready to run on real numbers, not estimates.",
    points: ["Everything in Starter", "Billing, invoicing & customer portal", "Fleet-wide cost & profitability tools"],
  },
  {
    name: "Enterprise",
    body: "For multi-depot or multi-branch logistics operators.",
    points: ["Everything in Growth", "AI Copilot across the full agent catalog", "Dedicated onboarding & support"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Pricing</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Priced around your fleet, not a seat count.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          DeployFleet is early — we&apos;re working closely with each fleet
          we onboard to build a plan around the size and shape of their
          operation. Talk to us and we&apos;ll put a real number in front of
          you, not a generic price list.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.name} className="card-surface flex flex-col p-8">
            <h2 className="text-lg font-semibold text-navy">{tier.name}</h2>
            <p className="mt-2 text-sm text-body">{tier.body}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {tier.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-body">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-emerald" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
            <Link href="/demo" className="btn-secondary mt-8 justify-center">
              Talk to us
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-col gap-3 sm:flex-row">
        <Link href="/demo" className="btn-primary">
          Book a Demo
        </Link>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
