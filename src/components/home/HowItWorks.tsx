import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";

const steps = [
  {
    number: "01",
    title: "Connect your fleet",
    body: "Add your trucks, drivers, routes, and customers. Your operation, modeled the way it actually runs — including consolidated loads and multi-leg trips.",
    screenshot: "Fleet Command Center — vehicle list with status chips",
  },
  {
    number: "02",
    title: "Dispatch & track",
    body: "Assign the right driver and truck in one tap. DeployFleet checks compliance automatically and flags anything that needs your attention first.",
    screenshot: "Dispatch Board — tap-to-assign in action",
  },
  {
    number: "03",
    title: "See your profit",
    body: "Every completed trip becomes a real number: cost per kilometre, margin per route, revenue per truck — not a spreadsheet built after the fact.",
    screenshot: "Financial Intelligence — KPI cards and trend table",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-card py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow justify-center">How it works</span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            From onboarding to your first profit report.
          </h2>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number}>
              <ScreenshotPlaceholder label={step.screenshot} aspect="video" />
              <div className="mt-5 flex items-start gap-3">
                <span className="text-gradient-brand text-2xl font-bold">{step.number}</span>
                <div>
                  <h3 className="text-lg font-semibold text-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-body">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
