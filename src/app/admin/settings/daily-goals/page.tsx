import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import DailyGoalsTab from "@/components/admin/DailyGoalsTab";

export const metadata: Metadata = { title: "Daily Goals" };

export default function AdminDailyGoalsPage() {
  return (
    <>
      <PageHeader
        title="Daily Goals"
        description="The daily targets that drive the Command Strip and Targets scoreboard — editable, with per-weekday overrides."
      />
      <DailyGoalsTab />
    </>
  );
}
