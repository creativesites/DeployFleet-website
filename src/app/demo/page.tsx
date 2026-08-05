import type { Metadata } from "next";
import DemoForm from "@/components/DemoForm";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "See DeployFleet running with your own trucks and routes loaded in — a real walkthrough, not a generic sales call.",
};

const expectations = [
  "A 20-minute walkthrough on your own screen or ours",
  "Your actual trucks, routes, and customers loaded in where possible",
  "A straight answer on whether it fits your fleet — including if it doesn't yet",
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-start">
        <div>
          <span className="section-eyebrow">Book a demo</span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
            See it with your own fleet.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-body">
            Tell us a bit about your operation and we&apos;ll set up a
            walkthrough built around it — not a generic slide deck.
          </p>

          <ul className="mt-8 space-y-4">
            {expectations.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-body">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="mt-0.5 shrink-0 text-emerald" aria-hidden="true">
                  <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M5.5 9.3l2.3 2.3 5-5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <DemoForm />
      </div>
    </div>
  );
}
