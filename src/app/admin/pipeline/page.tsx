import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import PipelineTab from "@/components/admin/PipelineTab";

export const metadata: Metadata = { title: "Pipeline" };

export default function AdminPipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Every prospect, grouped by stage. Tap a card's move menu to advance it." />
      <PipelineTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
