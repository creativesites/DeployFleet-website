import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect, listWhatsAppConversations } from "@/lib/crm";

export interface WhatsAppConversationListItem {
  id: string;
  prospectId: string;
  prospectName: string;
  whatsappJid: string;
  state: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  requiresResponse: boolean;
  responseUrgency: string | null;
}

/**
 * The WhatsApp Inbox's conversation list — per the user's explicit
 * direction, this only ever contains prospects already in DeployFleet's
 * system: `getOrCreateConversation` (crm.ts) is only ever called from
 * the outbound send route or the inbound webhook after
 * `findProspectByPhone()` finds a real match, so there is no code path
 * that creates a `WhatsAppConversation` for a number outside the CRM —
 * this route doesn't need its own filtering logic to enforce that, it's
 * already structurally true of the data it reads.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const conversations = await listWhatsAppConversations();
  const prospectCache = new Map<string, string | null>();

  const items: WhatsAppConversationListItem[] = [];
  for (const conv of conversations) {
    if (!prospectCache.has(conv.prospectId)) {
      const prospect = await getProspect(conv.prospectId);
      prospectCache.set(conv.prospectId, prospect?.name ?? null);
    }
    const prospectName = prospectCache.get(conv.prospectId);
    if (!prospectName) continue; // prospect no longer exists — skip rather than show an orphan row

    items.push({
      id: conv.id,
      prospectId: conv.prospectId,
      prospectName,
      whatsappJid: conv.whatsappJid,
      state: conv.state,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      unreadCount: conv.unreadCount,
      requiresResponse: conv.requiresResponse,
      responseUrgency: conv.responseUrgency,
    });
  }

  return NextResponse.json({ ok: true, conversations: items });
}
