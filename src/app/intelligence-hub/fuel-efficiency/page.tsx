import type { Metadata } from "next";
import FuelEfficiencyCalculator from "@/components/intelligence-hub/FuelEfficiencyCalculator";

export const metadata: Metadata = {
  title: "Fuel Cost & Efficiency Calculator",
  description:
    "Free fuel efficiency calculator for trucking companies — compare actual fuel use against your own baseline and flag anomalies early. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Fuel Cost & Efficiency Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free, deterministic fuel-efficiency calculator for trucking and logistics operators — actual vs. expected consumption, cost variance, and an anomaly flag.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What counts as an unusual fuel consumption variance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A trip using 10-20% more fuel than a vehicle's normal baseline is worth a look — load, route, or driver behaviour usually explains it. 20% or more is worth investigating more closely: under-inflated tyres, excessive idling, or in rarer cases fuel theft.",
      },
    },
    {
      "@type": "Question",
      name: "Why is there no default expected fuel consumption figure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fuel consumption varies significantly by vehicle, load weight, and route — there's no single number that's accurate across a fleet. Using each vehicle's own logged history as its baseline gives a far more useful comparison than an industry average.",
      },
    },
  ],
};

export default function FuelEfficiencyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FuelEfficiencyCalculator />
    </>
  );
}
