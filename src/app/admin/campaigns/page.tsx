import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import CampaignsTab from "@/components/admin/CampaignsTab";

export const metadata: Metadata = { title: "Campaigns" };

export default function AdminCampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Which sources and campaigns actually produce engaged visitors and conversions — plus the overall funnel."
      />
      <CampaignsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
