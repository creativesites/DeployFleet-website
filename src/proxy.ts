import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/**
 * Clerk protects every /admin route. Gracefully no-ops (passes every
 * request through untouched) when Clerk isn't configured yet — the same
 * "degrade instead of crash without credentials" discipline this
 * project uses everywhere else (see isAdminConfigured()'s old password
 * gate, the AI provider router, the diesel-price admin store). Without
 * this guard, clerkMiddleware() throws on missing keys and would 500
 * every single request on the site, not just /admin.
 */
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isAdminRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
