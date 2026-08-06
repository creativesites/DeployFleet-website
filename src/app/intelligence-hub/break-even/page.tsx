import type { Metadata } from "next";
import BreakEvenUtilisationCalculator from "@/components/intelligence-hub/BreakEvenUtilisationCalculator";

export const metadata: Metadata = {
  title: "Break-Even Utilisation Calculator",
  description:
    "Free break-even utilisation calculator for trucking fleets — the kilometres a truck needs to run each month to cover fixed costs, and a monthly cash flow projection. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Break-Even Utilisation Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free break-even utilisation calculator for trucking and logistics operators — computes the monthly kilometres a truck needs to cover its fixed costs, compares it to current utilisation, and projects monthly cash flow.",
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
      name: "What is break-even utilisation for a truck?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Break-even utilisation is the distance a truck needs to run in a month for its revenue, minus variable cost, to exactly cover its fixed monthly costs — below that point the truck is losing money regardless of how well it's driven; above it, every extra kilometre is profit.",
      },
    },
    {
      "@type": "Question",
      name: "How is the break-even point calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fixed monthly costs are divided by the contribution margin per kilometre — revenue per km minus variable cost per km. That gives the kilometres needed to break even; dividing by the truck's realistic maximum monthly kilometres gives a break-even utilisation percentage.",
      },
    },
    {
      "@type": "Question",
      name: "Why does the cash flow projection include a ramp-up period?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A new truck or a new route rarely starts at full utilisation — it typically builds up over a few months. Modelling that ramp-up shows realistically how many months of negative cash flow to expect before cumulative cash flow turns positive, rather than assuming full utilisation from day one.",
      },
    },
  ],
};

export default function BreakEvenPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <BreakEvenUtilisationCalculator />
    </>
  );
}
