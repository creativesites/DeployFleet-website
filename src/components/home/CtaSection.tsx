"use client";

import { useState, type FormEvent } from "react";
import { WHATSAPP_NUMBER, whatsappHref } from "@/lib/nav";

export default function CtaSection() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = `Hi DeployFleet, I'd like to see it running with my own fleet data.\n\nName: ${name}\nCompany: ${company}\nWhatsApp: ${phone}`;
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8" id="get-started">
      <div className="card-surface grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="section-eyebrow">Get started</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            See it with your own fleet.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-body">
            Book a 20-minute walkthrough, or tell us about your fleet and
            we&apos;ll set up a trial with your own trucks and routes loaded
            in — not a generic demo.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary mt-6 inline-flex"
          >
            Prefer WhatsApp? Chat with us directly
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium text-navy">
              Your name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
              placeholder="Chanda Mwansa"
            />
          </div>
          <div>
            <label htmlFor="company" className="text-sm font-medium text-navy">
              Company
            </label>
            <input
              id="company"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
              placeholder="Your trucking company"
            />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-medium text-navy">
              WhatsApp number
            </label>
            <input
              id="phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
              placeholder="+260 9XX XXX XXX"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            See It With Your Own Fleet Data
          </button>
          <p className="text-center text-xs text-muted">
            Sends straight to our WhatsApp — a real reply from a real person.
          </p>
        </form>
      </div>
    </section>
  );
}
