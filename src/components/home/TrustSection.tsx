import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";

const points = [
  {
    title: "Compliance is enforced, not just tracked",
    body: "A truck with an expired insurance or licensing document can't be dispatched without a logged, accountable override — the block happens at the point of dispatch, not in a report afterwards.",
  },
  {
    title: "Built for regional payroll and tax rules",
    body: "Payroll, statutory deductions, and invoicing are built around the region's own rules from the start, not adapted from a template designed elsewhere.",
  },
  {
    title: "Every AI action is audited",
    body: "Who was suggested what, who approved it, and when — logged for every AI-initiated action, every time, no exceptions.",
  },
];

export default function TrustSection() {
  return (
    <section className="bg-card py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="section-eyebrow">Trust & compliance</span>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              Built for the realities of running trucks, not just software.
            </h2>

            <div className="mt-8 space-y-6">
              {points.map((point) => (
                <div key={point.title} className="flex gap-3">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="mt-0.5 shrink-0 text-emerald" aria-hidden="true">
                    <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6.5 11.3l2.8 2.8 6-6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="font-semibold text-navy">{point.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-body">{point.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-2 sm:p-3">
            <ScreenshotPlaceholder
              label="Compliance Center — traffic-light wall"
              hint="public/screenshots/compliance-center.png"
              aspect="video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
