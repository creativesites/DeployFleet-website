import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { seedProspectsFromCsv, syncLeadsToProspects } from "@/lib/crm";

/** One button in the Prospects tab: seeds the 52-company outbound list (idempotent by name) and promotes any un-promoted website leads (idempotent by promotedToProspectId) in a single trigger. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const [seed, leads] = await Promise.all([seedProspectsFromCsv(), syncLeadsToProspects()]);
  return NextResponse.json({ ok: true, seed, leads });
}
