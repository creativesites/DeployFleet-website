import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createProspectContact, listProspectContacts } from "@/lib/crm";

/** §5.2 — Winston's own "Reception / Operations Manager / Unknown, each with their own number" example, made a real, browsable list per prospect. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const contacts = await listProspectContacts(id);
  return NextResponse.json({ ok: true, contacts });
}

interface RequestBody {
  name?: string | null;
  role?: string | null;
  phone?: string;
  isPrimary?: boolean;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }
  if (!body.phone?.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const contact = await createProspectContact({
    prospectId: id,
    name: body.name ?? null,
    role: body.role ?? null,
    phone: body.phone.trim(),
    isPrimary: body.isPrimary ?? false,
    discoveredVia: "manual",
  });

  return NextResponse.json({ ok: true, contact });
}
