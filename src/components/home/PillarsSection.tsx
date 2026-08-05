import Link from "next/link";
import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";

const pillars = [
  {
    title: "Dispatch & Driver Management",
    body: "Match the right driver and truck to every load in one tap. Ranked suggestions, urgency flags, and a compliance check built into the assignment itself.",
    href: "/product/dispatch",
    screenshot: "Dispatch Board — expanded shipment with ranked candidates",
  },
  {
    title: "Profitability & Fleet Health",
    body: "One view per truck: current trip, service due, tyres, fuel, insurance. Know cost per kilometre and margin per route, not just revenue.",
    href: "/product/fleet-maintenance",
    screenshot: "Fleet Command Center — Vehicle 360 view",
  },
  {
    title: "Compliance & Safety",
    body: "A truck with an expired document can't be dispatched without a logged, accountable override. Compliance stops being a spreadsheet you check when it's too late.",
    href: "/product/compliance",
    screenshot: "Compliance Center — traffic-light wall",
  },
];

export default function PillarsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="section-eyebrow justify-center">What you get</span>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
          Three problems. One system.
        </h2>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <Link key={pillar.href} href={pillar.href} className="card-surface flex flex-col p-6">
            <ScreenshotPlaceholder label={pillar.screenshot} aspect="square" />
            <h3 className="mt-5 text-lg font-semibold text-navy">{pillar.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-body">{pillar.body}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">
              Learn more
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
