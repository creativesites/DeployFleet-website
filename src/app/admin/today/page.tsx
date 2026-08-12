import type { Metadata } from "next";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import PageHeader from "@/components/admin/PageHeader";
import CommandStrip from "@/components/admin/CommandStrip";
import CommandCenter from "@/components/admin/CommandCenter";
import TodayTab from "@/components/admin/TodayTab";

export const metadata: Metadata = { title: "Today" };

/**
 * Revenue OS RS-0 §3 — /admin/today is the Daily Command Center: the
 * Command Strip (directives + weekly/today targets) and the Command Center
 * (system state, daily rhythm, the Orchestrator ask-box) now open the day
 * here, above Winston's prospect queue. The Command Center used to live on
 * /admin (Overview); it was relocated here so Today opens every workday.
 */
export default function AdminTodayPage() {
  const firebaseAdminConfigured = isFirebaseAdminConfigured();
  return (
    <>
      <PageHeader title="Today" description="Your command center — directive, targets, and the queue for right now." />
      <CommandStrip firebaseAdminConfigured={firebaseAdminConfigured} />
      <CommandCenter firebaseAdminConfigured={firebaseAdminConfigured} />
      <div className="mt-2">
        <h2 className="text-sm font-semibold text-navy">The queue</h2>
        <p className="mt-1 text-xs text-muted">Prospects due today or overdue, oldest first.</p>
        <div className="mt-4">
          <TodayTab firebaseAdminConfigured={firebaseAdminConfigured} />
        </div>
      </div>
    </>
  );
}
