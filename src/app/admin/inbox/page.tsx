import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import InboxTab from "@/components/admin/InboxTab";

export const metadata: Metadata = { title: "AI Inbox" };

export default function AdminInboxPage() {
  return (
    <>
      <PageHeader
        title="AI Inbox"
        description="Paste anything — an AI SDR's report, a call transcript, a WhatsApp export, your own note — and the system extracts facts, tasks, and decisions for you to review."
      />
      <InboxTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
