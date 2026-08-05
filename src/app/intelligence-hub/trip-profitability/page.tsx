import type { Metadata } from "next";
import TripProfitabilityCalculator from "@/components/intelligence-hub/TripProfitabilityCalculator";

export const metadata: Metadata = {
  title: "Trip Profitability Calculator",
  description:
    "Free trip profit calculator for trucking companies — see gross profit, margin, and the minimum viable rate for a load before you accept it. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Trip Profitability Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free, deterministic trip-profitability calculator for trucking and logistics operators — gross profit, margin, and the minimum viable rate for a specific load.",
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
      name: "How do I know if a load is worth taking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Compare the offered rate against your break-even rate for that trip — the rate at which revenue exactly covers fuel, driver allowance, tolls, and every other real cost for the distance. Anything above break-even is profit; anything below it loses money regardless of how full the truck is.",
      },
    },
    {
      "@type": "Question",
      name: "What is a healthy profit margin for a trucking trip?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There's no single universal number, but a trip clearing less than roughly 15% margin leaves very little room for a fuel price change, a delay, or an unexpected repair to turn it into a loss — worth treating as a signal to renegotiate the rate, not a hard rule.",
      },
    },
  ],
};

export default function TripProfitabilityPage() {
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
      <TripProfitabilityCalculator />
    </>
  );
}
