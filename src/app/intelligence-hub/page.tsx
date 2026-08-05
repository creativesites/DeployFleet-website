import type { Metadata } from "next";
import Link from "next/link";
import { intelligenceHubCalculators } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Intelligence Hub — Free Fleet Calculators",
  description:
    "Free, no-sign-up calculators for African trucking companies — cost per kilometre, trip profitability, fuel efficiency, and more. Real numbers, real math, no gate.",
};

export default function IntelligenceHubPage() {
  const live = intelligenceHubCalculators.filter((c) => c.live);
  const upcoming = intelligenceHubCalculators.filter((c) => !c.live);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Real numbers for running a fleet. Free, no sign-up.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Every calculator here does real, deterministic math — the same
          engine DeployFleet itself runs on, not a rough estimate. No
          account, no email, no gate on any result.
        </p>
      </div>

      <div className="mt-14">
        <h2 className="text-lg font-semibold text-navy">Available now</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((calc) => (
            <Link key={calc.href} href={calc.href} className="card-surface p-6">
              <h3 className="text-base font-semibold text-navy">{calc.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{calc.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">
                Open calculator
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mt-16">
          <h2 className="text-lg font-semibold text-navy">Coming next</h2>
          <p className="mt-2 text-sm text-muted">
            Built in order, shipped as they&apos;re ready — each one free
            from day one, same as the rest.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((calc) => (
              <div
                key={calc.href}
                className="rounded-df-lg border border-border bg-canvas p-5 opacity-80"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-navy">{calc.label}</h3>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                    Phase {calc.phase}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-body">{calc.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
