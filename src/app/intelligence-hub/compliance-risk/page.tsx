import type { Metadata } from "next";
import ComplianceRiskCalculator from "@/components/intelligence-hub/ComplianceRiskCalculator";

export const metadata: Metadata = {
  title: "Compliance & Penalty Risk Calculator",
  description:
    "Free compliance risk calculator for trucking companies — track document expiry, renewal cost, and estimated penalty exposure across your fleet. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Compliance & Penalty Risk Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free compliance-tracking calculator for trucking and logistics operators — expiry countdown, renewal cost, and estimated penalty exposure for a truck's recurring compliance documents.",
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
      name: "What counts as a compliance document for a truck?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Anything a truck legally needs to be on the road and stay there — insurance, road tax/licence, a fitness certificate, and any route or operating permits. Exactly which ones apply depends on your operation, which is why this calculator lets you name and track your own.",
      },
    },
    {
      "@type": "Question",
      name: "How is 'expiring soon' defined?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A document is flagged expiring soon inside a 30-day window before its expiry date — the same threshold DeployFleet's own compliance tracking uses. Outside that window it's shown as valid; past the expiry date it's shown as expired.",
      },
    },
    {
      "@type": "Question",
      name: "Where does the penalty exposure number come from?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It's your own estimate, not a published fine schedule — this calculator doesn't invent a regulatory penalty amount. Enter what you believe operating on an expired document would realistically cost you (a fine, impoundment, or a lost trip), and it totals that up only for documents that are currently expired.",
      },
    },
  ],
};

export default function ComplianceRiskPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ComplianceRiskCalculator />
    </>
  );
}
