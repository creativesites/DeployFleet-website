import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import GeographyTab from "@/components/admin/GeographyTab";

export const metadata: Metadata = { title: "Geography" };

export default function AdminGeographyPage() {
  return (
    <>
      <PageHeader title="Geography" description="Where visitors are coming from, by country and city." />
      <GeographyTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
