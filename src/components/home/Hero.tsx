import Link from "next/link";
import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";
import { whatsappHref } from "@/lib/nav";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--df-gradient-brand-wide)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="section-eyebrow justify-center">Mission Control for African Trucking</span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-navy sm:text-5xl lg:text-6xl">
            Command your <span className="text-gradient-brand">entire fleet</span> from one screen.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-body">
            DeployFleet replaces paper trip sheets and WhatsApp chaos with one
            system that dispatches smarter, catches compliance risk before it
            costs you, and shows you exactly which trucks and routes make
            money.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary w-full sm:w-auto">
              Book a Demo
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full sm:w-auto"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <div className="card-surface p-2 sm:p-3">
            <ScreenshotPlaceholder
              label="Mission Control — home dashboard"
              hint="Desktop screenshot, populated demo data (public/screenshots/mission-control.png)"
              aspect="video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
