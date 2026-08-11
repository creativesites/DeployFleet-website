import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import TodayTab from "@/components/admin/TodayTab";

export const metadata: Metadata = { title: "Today" };

export default function AdminTodayPage() {
  return (
    <>
      <PageHeader title="Today" description="Winston's queue — prospects due today or overdue, oldest first." />
      <TodayTab firebaseAdminConfigured={isFirebaseAdminConfigured()} />
    </>
  );
}
