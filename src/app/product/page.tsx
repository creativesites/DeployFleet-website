import type { Metadata } from "next";
import Link from "next/link";
import { productLinks } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Dispatch, fleet & maintenance, compliance, billing, and an AI copilot — one system built for how trucking companies actually run.",
};

export default function ProductOverviewPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Product</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Every part of running a fleet, in one system.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          DeployFleet is built domain by domain, replacing generic back-office
          screens with purpose-built workspaces for how a trucking company
          actually operates.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {productLinks.map((link) => (
          <Link key={link.href} href={link.href} className="card-surface p-6">
            <h2 className="text-lg font-semibold text-navy">{link.label}</h2>
            <p className="mt-2 text-sm leading-relaxed text-body">{link.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">
              Learn more
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
