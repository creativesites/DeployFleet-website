import type { Metadata } from "next";
import LoadOptimisationCalculator from "@/components/intelligence-hub/LoadOptimisationCalculator";

export const metadata: Metadata = {
  title: "Load Optimisation & Axle Weight Calculator",
  description:
    "Free axle load calculator for trucking fleets — check actual axle group loads against the harmonized regional axle load limits. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Load Optimisation & Axle Weight Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free axle load compliance calculator for trucking and logistics operators — checks steering, drive, tandem, and tridem axle group loads against harmonized regional limits, plus gross vehicle mass where applicable.",
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
      name: "Which axle load limits does this calculator use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The COMESA-EAC-SADC Tripartite harmonized axle load limits — the same regional framework Zambia operates under as a member state. These are a starting reference, not a substitute for confirming with RTSA directly before a real compliance decision.",
      },
    },
    {
      "@type": "Question",
      name: "Why is there a tolerance allowance before a group is flagged overloaded?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The harmonized framework itself grants a 5% tolerance on axle load limits, to account for cargo shifting slightly in transit. This calculator applies that same allowance rather than flagging overload the instant a group ticks over the bare legal number.",
      },
    },
    {
      "@type": "Question",
      name: "Why does the gross vehicle mass check say 'not applicable' sometimes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The sourced GVM figures only cover 6-axle (48 tonnes) and 7-plus-axle (56 tonnes) combinations. Below 6 total axles, this calculator doesn't have a sourced GVM cap to check against, so it only reports on individual axle group compliance rather than guessing a number.",
      },
    },
  ],
};

export default function LoadOptimisationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LoadOptimisationCalculator />
    </>
  );
}
