import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import ActivityTab from "@/components/admin/ActivityTab";

export const metadata: Metadata = { title: "Activity" };

export default function AdminActivityPage() {
  return (
    <>
      <PageHeader title="Activity" description="Every fact, task, decision, and reconciliation flag this system has recorded, chronologically." />
      <ActivityTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
