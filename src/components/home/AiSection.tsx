import Link from "next/link";
import Screenshot from "@/components/Screenshot";

const agents = [
  "Dispatch",
  "Fleet Analyst",
  "Maintenance",
  "Compliance",
  "Finance",
  "Customer",
];

export default function AiSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div
            className="card-surface p-2 sm:p-3"
            style={{ borderColor: "color-mix(in srgb, var(--df-ai-violet) 25%, var(--df-border))" }}
          >
            <Screenshot
              src="/screenshots/copilot-console.jpg"
              alt="DeployFleet Copilot Console — the six-agent catalog, each with a direct ask-a-question box"
              width={1080}
              height={1047}
            />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <span
            className="section-eyebrow"
            style={{ color: "var(--df-ai-violet)" }}
          >
            AI Copilot
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            AI that suggests. You decide. Every time.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-body">
            Six specialist agents watch dispatch, maintenance, compliance,
            finance, and customer activity, and surface what needs your
            attention — a truck likely to need service soon, a fuel log worth
            a second look, a load that&apos;s about to run late.
          </p>
          <p className="mt-4 text-base leading-relaxed text-body">
            None of it acts on its own. Every suggestion goes through the
            same rule: propose, you approve, then it executes — logged, every
            time. It&apos;s an assistant with an audit trail, not a service
            account with a mind of its own.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {agents.map((agent) => (
              <span
                key={agent}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  borderColor: "color-mix(in srgb, var(--df-ai-violet) 30%, transparent)",
                  color: "var(--df-ai-violet)",
                  background: "color-mix(in srgb, var(--df-ai-violet) 6%, transparent)",
                }}
              >
                {agent} Agent
              </span>
            ))}
          </div>

          <Link
            href="/product/ai-copilot"
            className="mt-8 inline-flex items-center gap-1 text-sm font-semibold"
            style={{ color: "var(--df-ai-violet)" }}
          >
            See how the Copilot works
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
