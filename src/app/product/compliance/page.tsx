import type { Metadata } from "next";
import ProductPageLayout from "@/components/ProductPageLayout";

export const metadata: Metadata = {
  title: "Compliance & Safety",
  description:
    "Dispatch is blocked automatically when a driver or vehicle document has expired — with a logged, accountable override for real emergencies.",
};

export default function CompliancePage() {
  return (
    <ProductPageLayout
      eyebrow="Compliance & Safety"
      title="Compliance risk, caught before it costs you."
      intro="A truck with an expired insurance document, or a driver whose license has lapsed, shouldn't stay just “the one that's available” until something goes wrong. DeployFleet checks compliance at the moment of dispatch, not in a report afterwards — and every override is logged to a real person."
      screenshotLabel="Compliance Center — traffic-light wall"
      screenshotHint="public/screenshots/compliance-center.png"
      features={[
        {
          title: "Dispatch-gated compliance",
          body: "Expired licenses, insurance, or roadworthiness documents block an assignment automatically — an emergency override is possible, but it's logged and accountable, never silent.",
        },
        {
          title: "One traffic-light view",
          body: "Every vehicle and driver document, colour-coded valid, expiring soon, or expired — across the whole fleet, in one screen.",
        },
        {
          title: "Driver performance, tracked honestly",
          body: "Accidents, harsh braking, late deliveries, and fuel anomalies roll up into a reliability score — a scorecard a driver can check themselves, not a hidden surveillance file.",
        },
        {
          title: "Built around regional rules",
          body: "Payroll and statutory deductions are built for the region's own compliance rules from the start, not retrofitted from a template designed elsewhere.",
        },
      ]}
    />
  );
}
