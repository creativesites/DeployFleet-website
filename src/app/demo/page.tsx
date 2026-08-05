import type { Metadata } from "next";
import { LIVE_DEMO_URL, whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Explore the Live Demo",
  description:
    "Jump straight into a live, running DeployFleet instance — one-click login for the Owner, Dispatcher, and Driver views.",
};

const roles = [
  { name: "Owner / Fleet Manager", body: "Mission Control, fleet-wide KPIs, and every workspace." },
  { name: "Dispatcher", body: "The Dispatch Board — book, assign, and track shipments." },
  { name: "Driver", body: "What a driver sees for their own trips and documents." },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
      <span className="section-eyebrow justify-center">Live demo</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
        See the real thing, right now.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-body">
        This isn&apos;t a sandbox with fake data bolted on afterwards — it&apos;s
        a live DeployFleet instance running a full demo fleet. Pick a role
        below and you&apos;re in, one click, no sign-up.
      </p>

      <a
        href={LIVE_DEMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-8 inline-flex text-base"
      >
        Launch the Live Demo
      </a>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {roles.map((role) => (
          <div key={role.name} className="card-surface p-5 text-left">
            <p className="text-sm font-semibold text-navy">{role.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-body">{role.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Once you&apos;re in, the login screen has a one-click option for each
        role — no password to remember.
      </p>

      <div className="mt-14 rounded-df-lg border border-border bg-card p-6 text-left sm:p-8">
        <p className="text-sm font-semibold text-navy">
          Want a walkthrough with your own fleet&apos;s data instead?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Message us and we&apos;ll set one up — trucks, routes, and
          customers loaded in, not a generic demo.
        </p>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 inline-flex">
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
