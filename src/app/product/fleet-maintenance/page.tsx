import type { Metadata } from "next";
import ProductPageLayout from "@/components/ProductPageLayout";

export const metadata: Metadata = {
  title: "Fleet & Maintenance",
  description:
    "One view per truck — trips, service, tyres, fuel, and insurance — plus fleet-wide maintenance planning and cost control.",
};

export default function FleetMaintenancePage() {
  return (
    <ProductPageLayout
      eyebrow="Fleet & Maintenance"
      title="Know which trucks are making you money."
      intro="Every truck gets one consolidated view: current trip, service due, tyre condition, recent fuel logs, and insurance status. Fleet-wide, a maintenance planner and cost tools turn scattered job cards and receipts into a real picture of what each truck actually costs to run."
      screenshotLabel="Fleet Maintenance Center — timeline and repair ledger"
      screenshotSrc="/screenshots/maintenance-center.png"
      features={[
        {
          title: "Vehicle 360",
          body: "Trips, compliance documents, maintenance schedule, tyres, insurance, and fuel history for one truck, in one screen — not five different menus.",
        },
        {
          title: "Maintenance Planner",
          body: "A calendar and timeline view of what's due and what's overdue across the whole fleet, with a worst-first vehicle health ranking.",
        },
        {
          title: "Fuel intelligence",
          body: "Consumption tracked per truck with anomalies flagged automatically — a fuel log that looks off gets surfaced, not buried in a spreadsheet.",
        },
        {
          title: "Real cost control",
          body: "Parts, tyres, and workshop job cards feed into an honest, verifiable cost-per-kilometre — not a number nobody can trace back to a receipt.",
        },
      ]}
    />
  );
}
