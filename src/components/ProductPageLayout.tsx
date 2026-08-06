import Link from "next/link";
import Screenshot from "@/components/Screenshot";
import ScreenshotPlaceholder from "@/components/ScreenshotPlaceholder";
import { whatsappHref } from "@/lib/nav";

type Feature = {
  title: string;
  body: string;
};

type ProductPageLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  screenshotLabel: string;
  screenshotHint?: string;
  screenshotSrc?: string;
  screenshotDims?: { width: number; height: number };
  features: Feature[];
  note?: string;
};

export default function ProductPageLayout({
  eyebrow,
  title,
  intro,
  screenshotLabel,
  screenshotHint,
  screenshotSrc,
  screenshotDims = { width: 1376, height: 768 },
  features,
  note,
}: ProductPageLayoutProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">{eyebrow}</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">{intro}</p>
      </div>

      <div className="card-surface mt-10 p-2 sm:p-3">
        {screenshotSrc ? (
          <Screenshot
            src={screenshotSrc}
            alt={screenshotLabel}
            width={screenshotDims.width}
            height={screenshotDims.height}
          />
        ) : (
          <ScreenshotPlaceholder label={screenshotLabel} hint={screenshotHint} aspect="video" />
        )}
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="card-surface p-6">
            <h3 className="text-base font-semibold text-navy">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-body">{feature.body}</p>
          </div>
        ))}
      </div>

      {note && (
        <p className="mt-10 rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
          {note}
        </p>
      )}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
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
