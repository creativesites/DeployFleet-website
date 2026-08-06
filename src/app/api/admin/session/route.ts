import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminConfigured, verifySessionToken } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: verifySessionToken(session),
  });
}
