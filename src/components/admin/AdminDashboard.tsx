"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import OverviewTab from "./OverviewTab";
import LeadsTab from "./LeadsTab";
import DieselPricesTab from "./DieselPricesTab";

type Tab = "overview" | "leads" | "diesel";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "diesel", label: "Diesel Prices" },
];

export default function AdminDashboard({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">DeployFleet Admin</h1>
          <p className="mt-1 text-sm text-body">Visitor stats, leads, and sourced figures — in one place.</p>
        </div>
        <UserButton />
      </div>

      <div className="mt-8 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-b-2 border-teal text-navy" : "text-muted hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "overview" && <OverviewTab firebaseAdminConfigured={firebaseAdminConfigured} />}
        {tab === "leads" && <LeadsTab firebaseAdminConfigured={firebaseAdminConfigured} />}
        {tab === "diesel" && <DieselPricesTab />}
      </div>
    </div>
  );
}
