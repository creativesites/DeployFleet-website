import type { Metadata } from "next";
import RoiPaybackCalculator from "@/components/intelligence-hub/RoiPaybackCalculator";

export const metadata: Metadata = {
  title: "DeployFleet ROI & Payback Calculator",
  description:
    "Free ROI calculator — see the payback period and 3-year return for adopting DeployFleet, based on your own quoted cost and your own savings estimate. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet ROI & Payback Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free ROI and payback-period calculator for trucking and logistics operators evaluating DeployFleet — computes payback period and 3-year return on investment from user-supplied cost and savings estimates.",
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
      name: "Where does the DeployFleet subscription cost in this calculator come from?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You enter it yourself — DeployFleet doesn't have fixed published pricing yet, so this calculator never assumes a number for you. Use your own quote, or a reasonable estimate, to see the payback math for your fleet specifically.",
      },
    },
    {
      "@type": "Question",
      name: "How is the payback period calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "One-time implementation cost divided by net monthly benefit (total estimated monthly savings minus the monthly subscription cost). If the net monthly benefit isn't positive, payback isn't reached at those numbers, rather than showing a misleading figure.",
      },
    },
    {
      "@type": "Question",
      name: "What counts as a monthly saving in this calculator?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Whatever you estimate — fuel waste caught, compliance penalties avoided, admin time saved, maintenance caught early, or anything else specific to your operation. These are your own estimates, not a guaranteed figure DeployFleet promises.",
      },
    },
  ],
};

export default function RoiPaybackPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <RoiPaybackCalculator />
    </>
  );
}
