import type { Metadata } from "next";
import CostPerKmCalculator from "@/components/intelligence-hub/CostPerKmCalculator";

export const metadata: Metadata = {
  title: "Cost Per Kilometre Calculator",
  description:
    "Free cost per kilometre calculator for trucking companies — fuel, fixed costs, tyres, maintenance, driver wages, and tolls, broken down. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Cost Per Kilometre Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free, deterministic cost-per-kilometre calculator for trucking and logistics operators, breaking down fuel, fixed costs, tyres, maintenance, driver wages, and tolls.",
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
      name: "What is cost per kilometre in trucking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cost per kilometre (CPK) is the total cost of operating a truck — fuel, fixed costs like insurance and financing, tyres, maintenance, driver wages, and tolls — divided by the distance it travels. It's the single number that tells you what it actually costs to move a truck one kilometre.",
      },
    },
    {
      "@type": "Question",
      name: "What should I include in fixed costs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fixed costs are expenses that don't change with distance driven: insurance, statutory contributions like NAPSA, licensing and fitness fees, loan or lease repayments, and yard rent or overhead. These are usually monthly amounts, spread across your monthly distance to get a per-kilometre figure.",
      },
    },
    {
      "@type": "Question",
      name: "Why does my fuel consumption matter so much?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fuel is usually the single largest cost category for a trucking operation, and it varies significantly by vehicle, load weight, and route — there's no universal default. Using your own logged consumption, not an industry average, gives the most accurate cost-per-kilometre figure.",
      },
    },
  ],
};

export default function CostPerKmPage() {
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
      <CostPerKmCalculator />
    </>
  );
}
