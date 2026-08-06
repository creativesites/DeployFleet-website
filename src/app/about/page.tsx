import type { Metadata } from "next";
import Link from "next/link";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "About",
  description:
    "DeployFleet is built by the team behind DeployGuard, rebuilding the same foundation around how African trucking companies actually run.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <span className="section-eyebrow">About</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
        Built for African trucking, from the ground up.
      </h1>

      <div className="mt-8 space-y-5 text-base leading-relaxed text-body">
        <p>
          DeployFleet started with a simple observation: trucking companies
          across the region were running serious operations — real trucks,
          real customers, real money — on paper trip sheets and WhatsApp
          groups, because nothing built for how they actually work existed.
        </p>
        <p>
          We&apos;re the team behind DeployGuard, a platform already running
          day-to-day operations for security companies across the region.
          DeployFleet takes that same foundation and rebuilds it, domain by
          domain, around trucking: dispatch, compliance, maintenance,
          billing, and an AI copilot that never acts without a human saying
          yes.
        </p>
        <p>
          We&apos;re building this closely with the fleets we onboard —
          starting in Zambia, expanding across the region as the product
          proves itself on real operations, not assumptions.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/demo" className="btn-primary">
          View Demo
        </Link>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
