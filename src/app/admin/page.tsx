import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isAdminAllowlistConfigured, isCurrentUserAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

function NotConfigured({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 sm:px-6">
      <h1 className="text-2xl font-bold text-navy">DeployFleet Admin</h1>
      <p className="mt-6 rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">{children}</p>
    </div>
  );
}

/**
 * Two independent gates, both required, checked server-side before any
 * dashboard content renders:
 *
 * 1. Clerk auth — proves *who* the visitor is. src/proxy.ts already
 *    redirects a signed-out visitor to sign in before this page ever
 *    runs when Clerk is configured; the `!clerkConfigured` branch below
 *    only fires when Clerk itself hasn't been set up yet, since the
 *    proxy no-ops in that case and lets everyone through.
 * 2. The ADMIN_ALLOWED_EMAILS allowlist — a signed-in Clerk user isn't
 *    automatically trusted with lead data; see adminAccess.ts.
 */
export default async function AdminPage() {
  if (!clerkConfigured) {
    return (
      <NotConfigured>
        Admin access isn&apos;t configured for this environment — set{" "}
        <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to enable it. See{" "}
        <code>.env.example</code>.
      </NotConfigured>
    );
  }

  if (!isAdminAllowlistConfigured()) {
    return (
      <NotConfigured>
        Clerk is configured, but no <code>ADMIN_ALLOWED_EMAILS</code> allowlist is set — nobody is admitted until
        it is, even a signed-in Clerk user. See <code>.env.example</code>.
      </NotConfigured>
    );
  }

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return (
      <NotConfigured>
        You&apos;re signed in, but this account isn&apos;t on the <code>ADMIN_ALLOWED_EMAILS</code> allowlist.
        Ask whoever manages this deployment to add your email if you should have access.
      </NotConfigured>
    );
  }

  return <AdminDashboard firebaseAdminConfigured={isFirebaseAdminConfigured()} />;
}
