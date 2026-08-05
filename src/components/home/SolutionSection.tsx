import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";

export default function SolutionSection() {
  return (
    <section className="bg-card py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="section-eyebrow">The DeployFleet way</span>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              One command center for your entire operation.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-body">
              Mission Control is the first screen anyone opens: what needs
              attention today, which trucks are active, what shipments are
              moving, and what&apos;s waiting on a decision. Not a menu of
              modules — an answer to &ldquo;is anything wrong today?&rdquo;
            </p>
            <p className="mt-4 text-base leading-relaxed text-body">
              Everything underneath it — dispatch, fleet health, compliance,
              billing — is built the same way: purpose-built screens for how
              a trucking company actually works, not a generic back-office
              system with trucking fields bolted on.
            </p>
          </div>

          <div className="card-surface p-2 sm:p-3">
            <ScreenshotPlaceholder
              label="Mission Control — attention strip + KPIs"
              hint="public/screenshots/mission-control-wide.png"
              aspect="video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
