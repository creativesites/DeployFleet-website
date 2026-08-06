import type { Metadata } from "next";
import Screenshot from "@/components/Screenshot";
import Link from "next/link";
import { whatsappHref } from "@/lib/nav";

export const metadata: Metadata = {
  title: "AI Copilot",
  description:
    "An AI operations assistant that watches dispatch, maintenance, compliance, and finance — and always asks before it acts.",
};

const agents = [
  { name: "Dispatch Agent", body: "Suggests driver and vehicle assignments for a shipment." },
  { name: "Fleet Analyst", body: "Watches utilisation and cost across the fleet." },
  { name: "Maintenance Agent", body: "Flags service risk before it becomes a breakdown." },
  { name: "Compliance Agent", body: "Surfaces expiring documents and regulatory risk." },
  { name: "Finance Agent", body: "Reviews invoices, margins, and payment risk." },
  { name: "Customer Agent", body: "Answers shipment and tracking questions." },
];

export default function AiCopilotPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow" style={{ color: "var(--df-ai-violet)" }}>
          AI Copilot
        </span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          An operations assistant that always asks first.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Six specialist agents watch your operation and surface what needs
          attention. None of them act on their own — every suggestion goes
          through the same rule: propose, you approve, then it executes,
          logged every time.
        </p>
      </div>

      <div
        className="card-surface mt-10 p-2 sm:p-3"
        style={{ borderColor: "color-mix(in srgb, var(--df-ai-violet) 25%, var(--df-border))" }}
      >
        <Screenshot
          src="/screenshots/copilot-console.jpg"
          alt="DeployFleet Copilot Console — usage & cost dashboard and the six-agent catalog"
          width={1080}
          height={1047}
        />
      </div>

      <h2 className="mt-16 text-2xl font-bold text-navy">The agent catalog</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="rounded-df-lg border p-5"
            style={{
              borderColor: "color-mix(in srgb, var(--df-ai-violet) 18%, var(--df-border))",
              background: "color-mix(in srgb, var(--df-ai-violet) 4%, white)",
            }}
          >
            <p className="font-semibold text-navy">{agent.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-body">{agent.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="section-eyebrow" style={{ color: "var(--df-ai-violet)" }}>
            Real predictions, not a mockup
          </span>
          <h2 className="mt-3 text-2xl font-bold text-navy">The Maintenance Agent, at work.</h2>
          <p className="mt-4 text-base leading-relaxed text-body">
            Every prediction is a genuine computed risk score — trend in fuel
            consumption, recent workshop activity, and more — with the
            reasoning shown alongside it, not just a number. High-risk
            vehicles surface first, low-risk ones stay out of the way.
          </p>
        </div>
        <div
          className="card-surface p-2 sm:p-3"
          style={{ borderColor: "color-mix(in srgb, var(--df-ai-violet) 25%, var(--df-border))" }}
        >
          <Screenshot
            src="/screenshots/ai-predictions.jpg"
            alt="DeployFleet AI Predictions — fleet-wide maintenance risk, worst-first"
            width={1080}
            height={1023}
          />
        </div>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-navy">Nothing acts without you</h3>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Every AI-initiated action follows the same pipeline: suggestion,
            permission check, your approval, execution, audit log. There is
            no path where AI writes to your data on its own.
          </p>
        </div>
        <div className="card-surface p-6">
          <h3 className="text-base font-semibold text-navy">Switched off where it should be</h3>
          <p className="mt-2 text-sm leading-relaxed text-body">
            AI can be turned off entirely, or per feature — payroll and
            financial data can be excluded from AI access independently of
            everything else.
          </p>
        </div>
      </div>

      <p className="mt-10 rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        DeployFleet&apos;s AI features are under active development and
        calibrated against demo data today. Treat AI-generated insights as a
        second opinion worth checking, not a guarantee — and every write it
        proposes still needs your yes.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/demo" className="btn-primary">
          View Demo
        </Link>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
