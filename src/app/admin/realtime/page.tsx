import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import RealtimeTab from "@/components/admin/RealtimeTab";

export const metadata: Metadata = { title: "Real-Time" };

export default function AdminRealtimePage() {
  return (
    <>
      <PageHeader title="Real-Time" description="Visitors active on the site right now." />
      <RealtimeTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
