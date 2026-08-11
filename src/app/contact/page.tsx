import type { Metadata } from "next";
import DemoForm from "@/components/DemoForm";
import TrackedWhatsAppLink from "@/components/analytics/TrackedWhatsAppLink";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to DeployFleet on WhatsApp or send us your details.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-start">
        <div>
          <span className="section-eyebrow">Contact</span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
            Talk to a real person.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-body">
            The fastest way to reach us is WhatsApp — a real reply, usually
            the same day. Prefer to leave your details instead? Use the form.
          </p>

          <TrackedWhatsAppLink location="contact_page_hero" className="btn-primary mt-8 inline-flex">
            Chat on WhatsApp
          </TrackedWhatsAppLink>
        </div>

        <DemoForm
          submitLabel="Send via WhatsApp"
          intro="Tell us a bit about your fleet and what you're trying to solve — we'll follow up on WhatsApp."
        />
      </div>
    </div>
  );
}
