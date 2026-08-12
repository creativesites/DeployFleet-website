import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { markConversationRead } from "@/lib/crm";

/** Called by the Inbox the moment Winston opens a conversation — clears the unread badge and requiresResponse flag. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  await markConversationRead(id);
  return NextResponse.json({ ok: true });
}
