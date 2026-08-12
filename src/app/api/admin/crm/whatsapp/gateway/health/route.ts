import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { checkGatewayHealth } from "@/lib/whatsapp/gatewayClient";

export const dynamic = "force-dynamic";

/**
 * Diagnostics-only: is the whatsapp-service container even reachable at
 * all from this deployment, independent of whether a WhatsApp session is
 * connected. Added after "still shows Connect"/"Verify number isn't
 * working" turned out to be undiagnosable from the UI — this answers the
 * first, narrowest question in that troubleshooting chain so Winston (or
 * a future debugging session) doesn't have to guess whether the problem
 * is network reachability, auth, or a genuinely dropped WhatsApp session.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const result = await checkGatewayHealth();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, must-revalidate" } });
}
