import type { Metadata } from "next";
import FleetTcoCalculator from "@/components/intelligence-hub/FleetTcoCalculator";

export const metadata: Metadata = {
  title: "Fleet Total Cost of Ownership (TCO) Calculator",
  description:
    "Free fleet TCO calculator for trucking companies — project purchase price, running costs, and resale value year by year to find the truck's optimal replacement point. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Fleet Total Cost of Ownership Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free lifecycle cost calculator for trucking and logistics operators — projects a truck's total cost of ownership year by year, accounting for rising maintenance costs and declining resale value, to find the lowest-cost replacement year.",
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
      name: "What is total cost of ownership for a truck?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Total cost of ownership (TCO) is the purchase price plus every running cost over the years you own a truck — fuel, maintenance, tyres, insurance, financing — minus what you'd get reselling it, expressed as a cost per year or per kilometre.",
      },
    },
    {
      "@type": "Question",
      name: "Why does the optimal replacement year matter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "As a truck ages, maintenance costs typically climb while resale value keeps falling. The optimal replacement year is the point where the equivalent annual cost of ownership is lowest — holding on longer past that point usually costs more per year, not less, even though the truck is already paid for.",
      },
    },
    {
      "@type": "Question",
      name: "Does this calculator account for financing and taxes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It includes an annual financing/loan repayment figure you provide, but deliberately keeps the math simple — no discounted present-value or tax-shield modelling — so the projection stays easy to reason about and adjust against your own numbers.",
      },
    },
  ],
};

export default function FleetTcoPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FleetTcoCalculator />
    </>
  );
}
