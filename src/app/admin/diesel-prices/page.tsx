import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import DieselPricesTab from "@/components/admin/DieselPricesTab";

export const metadata: Metadata = { title: "Diesel Prices" };

export default function AdminDieselPricesPage() {
  return (
    <>
      <PageHeader title="Diesel Prices" description="Per-country diesel price overrides used across the calculators." />
      <DieselPricesTab />
    </>
  );
}
