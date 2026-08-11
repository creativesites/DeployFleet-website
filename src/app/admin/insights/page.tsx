import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import InsightsTab from "@/components/admin/InsightsTab";

export const metadata: Metadata = { title: "Insights" };

export default function AdminInsightsPage() {
  return (
    <>
      <PageHeader title="Insights" description="Deterministic alerts, plus an on-demand AI-generated summary." />
      <InsightsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
