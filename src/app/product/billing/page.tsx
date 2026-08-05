import type { Metadata } from "next";
import ProductPageLayout from "@/components/ProductPageLayout";

export const metadata: Metadata = {
  title: "Billing & Customers",
  description:
    "Invoices generated from completed trips, a portal your customers can check themselves, and one view of every customer relationship.",
};

export default function BillingPage() {
  return (
    <ProductPageLayout
      eyebrow="Billing & Customers"
      title="Invoicing that starts from a completed trip, not a spreadsheet."
      intro="A delivered shipment turns into an invoice automatically, built from real rate cards and contract terms. Customers can check shipment status themselves instead of calling you, and you get one view of every customer's contracts, active shipments, and outstanding balance."
      screenshotLabel="Financial Intelligence — revenue, margin, and cost per kilometre"
      screenshotSrc="/screenshots/financial-intelligence.png"
      features={[
        {
          title: "Automatic invoicing",
          body: "Completed trips flow straight into an invoice against the right rate card and contract — no re-keying numbers from a trip sheet.",
        },
        {
          title: "ZRA Smart Invoice, built in",
          body: "In Zambia, invoices submit to ZRA's Smart Invoice system as part of the normal billing flow — not a separate manual step at month-end.",
        },
        {
          title: "Customer 360",
          body: "Contracts, active shipments, recent invoices, and outstanding balance for every customer in one place.",
        },
        {
          title: "A portal your customers actually use",
          body: "Shipment status and proof of delivery, visible to your customer without a phone call to your office.",
        },
        {
          title: "Freight cost calculator",
          body: "Know your cost and margin on a lane before you quote it, not after the trip is already run.",
        },
      ]}
    />
  );
}
