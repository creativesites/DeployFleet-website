import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import TargetsTab from "@/components/admin/TargetsTab";

export const metadata: Metadata = { title: "Targets" };

export default function AdminTargetsPage() {
  return (
    <>
      <PageHeader
        title="Targets"
        description="The Sales Playbook's daily benchmark — 10 attempts, 5 meaningful interactions — tracked week by week."
      />
      <TargetsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
