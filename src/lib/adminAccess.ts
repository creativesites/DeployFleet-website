import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

/**
 * A signed-in Clerk user isn't automatically an admin — Clerk only
 * proves *who* someone is, not that they're one of the small number of
 * trusted people allowed into /admin. This allowlist is the second,
 * separate gate. Fails closed: an unset ADMIN_ALLOWED_EMAILS means
 * nobody is admitted, not "any signed-in user" — same discipline as the
 * old password-based isAdminConfigured().
 */
export function isAdminAllowlistConfigured(): boolean {
  return Boolean(process.env.ADMIN_ALLOWED_EMAILS);
}

function allowlist(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isAdminAllowlistConfigured()) return false;
  const user = await currentUser();
  if (!user) return false;
  const allowed = allowlist();
  return user.emailAddresses.some((e) => allowed.includes(e.emailAddress.toLowerCase()));
}

/**
 * Shared guard for every /api/admin/* route handler — returns a
 * ready-to-return NextResponse when access should be denied, or null
 * when the caller is a confirmed admin and the route should proceed.
 * `src/proxy.ts` already blocks a signed-out visitor from reaching
 * these routes at all; this adds the second, separate allowlist check
 * Clerk itself doesn't know about.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!isAdminAllowlistConfigured()) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  return null;
}
