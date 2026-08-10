import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";

const LIST_LIMIT = 500;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const sourceFilter = request.nextUrl.searchParams.get("source");

  const snapshot = await getAdminFirestore()
    .collection("leads")
    .orderBy("createdAt", "desc")
    .limit(LIST_LIMIT)
    .get();

  const leads = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        company: data.company as string,
        phone: data.phone as string,
        fleetSize: (data.fleetSize ?? null) as string | null,
        message: (data.message ?? null) as string | null,
        source: data.source as string,
        status: data.status as string,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    })
    // Filtered in-memory rather than via a Firestore .where() +
    // .orderBy() combo on different fields, which needs a composite
    // index created in the Firebase console first — not worth the
    // extra manual-setup step at this data volume (a marketing site's
    // lead count, not a high-scale query).
    .filter((lead) => !sourceFilter || lead.source === sourceFilter);

  return NextResponse.json({ ok: true, leads });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || typeof id !== "string" || !LEAD_STATUSES.includes(status as LeadStatus)) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  await getAdminFirestore().collection("leads").doc(id).update({ status });
  return NextResponse.json({ ok: true });
}
