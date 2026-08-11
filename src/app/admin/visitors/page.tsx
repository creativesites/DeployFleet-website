import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import VisitorsTab from "@/components/admin/VisitorsTab";

export const metadata: Metadata = { title: "Visitors" };

export default function AdminVisitorsPage() {
  return (
    <>
      <PageHeader
        title="Visitors"
        description="Identity, engagement, acquisition, geography, technology, behavior, and full timeline per visitor."
      />
      <VisitorsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
