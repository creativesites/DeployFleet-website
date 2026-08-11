import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import ProspectsTab from "@/components/admin/ProspectsTab";

export const metadata: Metadata = { title: "Prospects" };

export default function AdminProspectsPage() {
  return (
    <>
      <PageHeader
        title="Prospects"
        description="Every prospect in DeployFleet's own pipeline — outbound cold list and promoted website leads."
      />
      <ProspectsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
