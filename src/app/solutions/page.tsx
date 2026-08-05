import type { Metadata } from "next";
import Link from "next/link";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "DeployFleet for fleet owners, dispatchers, and fleet & workshop managers — the same system, built for how each role actually works.",
};

const audiences = [
  {
    title: "For Fleet Owners & Directors",
    body: "You need to know where money is leaking, what your real exposure to compliance risk is, and which trucks and routes actually make money — without living inside the software yourself.",
    points: [
      "One dashboard: what needs your attention today",
      "Real cost-per-kilometre and margin per route",
      "Compliance risk caught before it becomes a liability",
    ],
  },
  {
    title: "For Dispatchers & Operations Managers",
    body: "You're running the day out of a phone. DeployFleet replaces the WhatsApp group and the paper trip sheet with one working view — built for a phone or tablet, not a desk.",
    points: [
      "Ranked driver & truck suggestions for every load",
      "One-tap assignment with compliance checked automatically",
      "Every shipment's status, in one place, all day",
    ],
  },
  {
    title: "For Fleet & Workshop Managers",
    body: "You own uptime and maintenance spend. See fleet health at a glance instead of reconstructing it from paper job cards after the fact.",
    points: [
      "One consolidated view per truck: service, tyres, fuel, insurance",
      "A worst-first maintenance queue, not a spreadsheet",
      "Parts and workshop costs tracked to the job, not estimated",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Solutions</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          One system. Built differently for every role.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          DeployFleet isn&apos;t one screen everyone shares — it&apos;s a
          purpose-built workspace for whichever job you actually do.
        </p>
      </div>

      <div className="mt-14 space-y-10">
        {audiences.map((audience) => (
          <div key={audience.title} className="card-surface p-8">
            <h2 className="text-xl font-semibold text-navy">{audience.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-body">{audience.body}</p>
            <ul className="mt-5 space-y-2">
              {audience.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-body">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-emerald" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
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
