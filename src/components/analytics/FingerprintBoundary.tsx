"use client";

import { type ReactNode } from "react";
import { FingerprintProvider } from "@fingerprint/react";

/**
 * Spec §2 — wraps the app in <FingerprintProvider> only when a real
 * public key is configured, same graceful-degradation pattern as
 * ClerkProvider in layout.tsx. Without it, the site works exactly as
 * before (legacy localStorage visitor id only, spec §28's "gracefully
 * fail if Fingerprint is unavailable").
 */
const publicApiKey = process.env.NEXT_PUBLIC_FINGERPRINT_PUBLIC_API_KEY;
const region = (process.env.NEXT_PUBLIC_FINGERPRINT_REGION as "eu" | "ap" | undefined) || undefined;

export const fingerprintConfigured = Boolean(publicApiKey);

export default function FingerprintBoundary({ children }: { children: ReactNode }) {
  if (!fingerprintConfigured) return <>{children}</>;

  return (
    <FingerprintProvider apiKey={publicApiKey as string} region={region}>
      {children}
    </FingerprintProvider>
  );
}
