"use client";

import { LIVE_DEMO_URL, whatsappHref } from "@/lib/nav";
import DemoForm from "@/components/DemoForm";
import { useDemoUnlocked } from "@/lib/useDemoUnlocked";

const roles = [
  { name: "Owner / Fleet Manager", body: "Mission Control, fleet-wide KPIs, and every workspace." },
  { name: "Dispatcher", body: "The Dispatch Board — book, assign, and track shipments." },
  { name: "Driver", body: "What a driver sees for their own trips and documents." },
];

/**
 * Implements the "Planned: gated demo access" behavior from README.md —
 * collect the visitor's details first, then reveal the live demo link.
 * The unlock persists per-browser (see useDemoUnlocked), so a returning
 * visitor doesn't have to fill the form again.
 */
export default function DemoGate() {
  const { unlocked, unlock } = useDemoUnlocked();

  if (!unlocked) {
    return (
      <div className="mx-auto mt-10 max-w-md">
        <DemoForm
          submitLabel="Unlock the Live Demo"
          intro="Tell us a bit about your fleet and the live demo opens right here — we'll also follow up on WhatsApp if you want a walkthrough with your own data."
          source="demo-gate"
          onSubmitted={unlock}
        />
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}
