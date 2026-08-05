import type { Metadata } from "next";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Resources",
  description: "Guides and updates on running a trucking operation — coming soon.",
};

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-28">
      <span className="section-eyebrow justify-center">Resources</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
        Guides for running a fleet, coming soon.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-body">
        We&apos;re building out practical guides on dispatch, compliance, and
        fleet cost control. In the meantime, message us directly — we&apos;ll
        answer real questions faster than a blog post could.
      </p>
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-primary mt-8 inline-flex">
        Chat on WhatsApp
      </a>
    </div>
  );
}
