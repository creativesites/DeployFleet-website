"use client";

import type { ReactNode } from "react";
import { whatsappHref } from "@/lib/nav";
import { analytics } from "@/lib/analytics/client";

/**
 * A tracked wrapper for the many one-off `<a href={whatsappHref}>` CTAs
 * scattered across the marketing/product pages (about, pricing,
 * solutions, resources, product/*) — those server components can't
 * attach an onClick directly, so this small client component is the drop-in
 * replacement. Only wired into src/app/contact/page.tsx so far (spec
 * §10's highest-traffic contact CTA); the floating button and both Navbar
 * links (which cover every page already) were wired directly instead.
 * Retrofitting the remaining per-page WhatsApp CTAs to use this is a
 * deliberately deferred follow-up, not done in this pass.
 */
export default function TrackedWhatsAppLink({
  location,
  className,
  children,
}: {
  location: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void analytics.conversion("whatsapp_click", { location })}
      className={className}
    >
      {children}
    </a>
  );
}
