import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect, getWhatsAppConversation, listWhatsAppMessages } from "@/lib/crm";

/** The Inbox's message-thread pane. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const conversation = await getWhatsAppConversation(id);
  if (!conversation) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const [prospect, messages] = await Promise.all([getProspect(conversation.prospectId), listWhatsAppMessages(id)]);

  return NextResponse.json({ ok: true, conversation, prospect, messages });
}
