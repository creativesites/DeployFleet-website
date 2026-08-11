import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import DecisionsTab from "@/components/admin/DecisionsTab";

export const metadata: Metadata = { title: "Decisions" };

export default function AdminDecisionsPage() {
  return (
    <>
      <PageHeader title="Decisions" description="The Decision Ledger — never edited in place, only superseded, so the system's reasoning stays auditable over time." />
      <DecisionsTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
