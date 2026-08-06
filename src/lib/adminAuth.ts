import { createHmac, timingSafeEqual } from "crypto";

/**
 * A deliberately minimal password-gate session, not a full auth
 * provider (Clerk stays the confirmed Phase E/F stack for real user
 * accounts — see the Intelligence Hub plan §11). This exists only to
 * gate the one internal `/admin` route a small number of trusted people
 * use to update sourced figures — a single shared password behind a
 * signed, httpOnly cookie, not a multi-user system.
 */

export const ADMIN_SESSION_COOKIE = "deployfleet_admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(candidate: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(real);
  // timingSafeEqual throws on length mismatch — compare length first,
  // still constant-time for the actual byte comparison that matters.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !isAdminConfigured()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}
