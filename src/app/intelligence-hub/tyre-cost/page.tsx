import type { Metadata } from "next";
import TyreCostPerKmCalculator from "@/components/intelligence-hub/TyreCostPerKmCalculator";

export const metadata: Metadata = {
  title: "Tyre Cost Per Kilometre Calculator",
  description:
    "Free tyre cost calculator for trucking fleets — compare budget vs. premium tyres on total cost per kilometre over their full working life, not sticker price. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Tyre Cost Per Kilometre Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free tyre lifecycle cost calculator for trucking and logistics operators — compares budget and premium tyre options on cost per kilometre, including retreads, and projects annual cost per vehicle.",
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
      name: "Why compare tyres on cost per kilometre instead of price?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A cheaper tyre that wears out twice as fast and can't be retreaded often costs more per kilometre than a pricier tyre with a longer casing life and multiple retreads. Cost per km accounts for the tyre's entire working life, not just what you pay at purchase.",
      },
    },
    {
      "@type": "Question",
      name: "How are retreads factored into the lifecycle cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each retread adds its own cost and its own (usually shorter) km of tread life on top of the original casing. Total lifecycle cost is the purchase price plus every retread's cost; total lifecycle km is the original tread life plus every retread's life.",
      },
    },
    {
      "@type": "Question",
      name: "Why does the number of tyre positions on the vehicle matter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cost per kilometre is a per-tyre figure. A vehicle with more tyre positions — an articulated combination versus a rigid truck, for example — accumulates that cost across every position simultaneously, so the annual cost per vehicle scales with how many tyres it actually runs.",
      },
    },
  ],
};

export default function TyreCostPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <TyreCostPerKmCalculator />
    </>
  );
}
