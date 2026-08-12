import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import WhatsAppInboxTab from "@/components/admin/WhatsAppInboxTab";

export const metadata: Metadata = { title: "WhatsApp" };

export default function AdminWhatsAppPage() {
  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Every WhatsApp conversation with a prospect already in DeployFleet — nothing else. Reply here, or send the first message from a prospect's own page."
      />
      <WhatsAppInboxTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
