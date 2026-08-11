import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import TeamTab from "@/components/admin/TeamTab";

export const metadata: Metadata = { title: "Team" };

export default function AdminTeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="The AI workforce — personas Winston pastes conversations on behalf of, so their reports and instructions become part of the system's memory."
      />
      <TeamTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
