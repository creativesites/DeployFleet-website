import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import LeadsTab from "@/components/admin/LeadsTab";

export const metadata: Metadata = { title: "Leads" };

export default function AdminLeadsPage() {
  return (
    <>
      <PageHeader title="Leads" description="Every submission from the Contact form, homepage CTA, and demo gate." />
      <LeadsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
