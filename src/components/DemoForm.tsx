"use client";

import { useState, type FormEvent } from "react";
import { WHATSAPP_NUMBER } from "@/lib/nav";
import { submitLead, type LeadSource } from "@/lib/leads";
import { analytics } from "@/lib/analytics/client";

type DemoFormProps = {
  submitLabel?: string;
  intro?: string;
  source?: LeadSource;
  onSubmitted?: () => void;
};

export default function DemoForm({
  submitLabel = "Book My Demo",
  intro,
  source = "contact-form",
  onSubmitted,
}: DemoFormProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [fleetSize, setFleetSize] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = [
      "Hi DeployFleet, I'd like to book a demo.",
      "",
      `Name: ${name}`,
      `Company: ${company}`,
      `WhatsApp: ${phone}`,
      fleetSize ? `Fleet size: ${fleetSize}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Fire-and-forget — never blocks the WhatsApp handoff below, which
    // stays the real, always-working submission path.
    submitLead({ name, company, phone, fleetSize, source });
    void analytics.conversion(source === "contact-form" ? "contact_request" : "demo_request", { source });

    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );

    onSubmitted?.();
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface space-y-4 p-8 sm:p-10">
      {intro && <p className="text-sm text-muted">{intro}</p>}
      <div>
        <label htmlFor="demo-name" className="text-sm font-medium text-navy">
          Your name
        </label>
        <input
          id="demo-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
          placeholder="Chanda Mwansa"
        />
      </div>
      <div>
        <label htmlFor="demo-company" className="text-sm font-medium text-navy">
          Company
        </label>
        <input
          id="demo-company"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
          placeholder="Your trucking company"
        />
      </div>
      <div>
        <label htmlFor="demo-phone" className="text-sm font-medium text-navy">
          WhatsApp number
        </label>
        <input
          id="demo-phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
          placeholder="+260 9XX XXX XXX"
        />
      </div>
      <div>
        <label htmlFor="demo-fleet-size" className="text-sm font-medium text-navy">
          Fleet size <span className="text-muted">(optional)</span>
        </label>
        <input
          id="demo-fleet-size"
          value={fleetSize}
          onChange={(e) => setFleetSize(e.target.value)}
          className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
          placeholder="e.g. 12 trucks"
        />
      </div>
      <button type="submit" className="btn-primary w-full">
        {submitLabel}
      </button>
      <p className="text-center text-xs text-muted">
        Sends straight to our WhatsApp — a real reply from a real person.
      </p>
    </form>
  );
}
