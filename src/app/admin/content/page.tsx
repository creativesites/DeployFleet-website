import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import ContentTab from "@/components/admin/ContentTab";

export const metadata: Metadata = { title: "Content" };

export default function AdminContentPage() {
  return (
    <>
      <PageHeader
        title="Content"
        description="Per-page views, unique visitors, bounce rate, engagement, and conversion rate."
      />
      <ContentTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
