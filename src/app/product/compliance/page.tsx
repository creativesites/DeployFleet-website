import type { Metadata } from "next";
import Link from "next/link";
import Screenshot from "@/components/Screenshot";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Compliance & Safety",
  description:
    "Dispatch is blocked automatically when a driver or vehicle document has expired — with a logged, accountable override for real emergencies. Built for Zambian ZRA, NAPSA, NHIMA, and PAYE rules today.",
};

const features = [
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
    title: "Built around regional rules, not retrofitted",
    body: "Payroll, tax, and statutory deductions are built for the region's own compliance rules from the start — not adapted from a template designed for somewhere else.",
  },
];

const zambiaFeatures = [
  {
    title: "ZRA Smart Invoice",
    body: "Invoices submit straight to Zambia Revenue Authority's Smart Invoice system as part of the normal billing flow — not a separate manual step someone has to remember.",
  },
  {
    title: "NAPSA & NHIMA, calculated automatically",
    body: "Statutory pension and health insurance contributions are computed on every payslip, not worked out by hand at month-end.",
  },
  {
    title: "PAYE done right",
    body: "Income tax deductions follow Zambia's actual PAYE bands — the calculation HR usually dreads is just correct, every time.",
  },
  {
    title: "Loan and advance deductions",
    body: "Driver advances and staff loans deduct from payroll automatically against the right balance — no separate spreadsheet reconciled against payslips by hand.",
  },
];

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Compliance & Safety</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Compliance risk, caught before it costs you.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          A truck with an expired insurance document, or a driver whose
          license has lapsed, shouldn&apos;t stay just &ldquo;the one
          that&apos;s available&rdquo; until something goes wrong. DeployFleet
          checks compliance at the moment of dispatch, not in a report
          afterwards — and every override is logged to a real person.
        </p>
      </div>

      <div className="card-surface mt-10 p-2 sm:p-3">
        <Screenshot
          src="/screenshots/compliance-center.png"
          alt="Compliance Center — traffic-light wall of vehicle and driver documents"
          width={1376}
          height={768}
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="card-surface p-6">
            <h3 className="text-base font-semibold text-navy">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{feature.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-df-xl border border-border bg-canvas p-8 sm:p-10">
        <span className="section-eyebrow">Built for Zambia today</span>
        <h2 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">
          Real local compliance, not a generic template.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-body">
          DeployFleet is expanding across African trucking, but Zambia is
          where we operate today — and it shows in the details that usually
          cause the most headaches.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {zambiaFeatures.map((feature) => (
            <div key={feature.title} className="rounded-df-lg border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-navy">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/demo" className="btn-primary">
          Book a Demo
        </Link>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
