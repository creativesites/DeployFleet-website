import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import OverviewTab from "@/components/admin/OverviewTab";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Visitor stats and lead pipeline, at a glance." />
      <OverviewTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
