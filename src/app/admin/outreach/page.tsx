import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import OutreachTab from "@/components/admin/OutreachTab";

export const metadata: Metadata = { title: "Outreach" };

export default function AdminOutreachPage() {
  return (
    <>
      <PageHeader
        title="Outreach"
        description="Batches of outbound activity — each with its own attempt and meaningful-interaction targets."
      />
      <OutreachTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
