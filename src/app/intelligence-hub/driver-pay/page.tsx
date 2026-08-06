import type { Metadata } from "next";
import DriverPayCalculator from "@/components/intelligence-hub/DriverPayCalculator";

export const metadata: Metadata = {
  title: "Driver Pay & Advance Calculator",
  description:
    "Free driver pay calculator for Zambian trucking companies — NAPSA, PAYE, and NHIMA worked out correctly, plus advance recovery. No sign-up required.",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DeployFleet Driver Pay & Advance Calculator",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "A free driver pay calculator for Zambian trucking and logistics operators — gross pay, NAPSA, PAYE, NHIMA, and advance recovery, worked out to a net payable figure.",
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
      name: "How is PAYE calculated on a Zambian driver's salary?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PAYE is applied progressively across income bands after the employee's NAPSA contribution is deducted from gross pay — the first portion of income is tax-free, and each higher band is taxed at a higher rate, but only on the income within that band, not the whole salary.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between NAPSA and NHIMA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "NAPSA is a pension contribution, split between employee and employer, capped at a monthly ceiling. NHIMA is a health insurance contribution, a flat 1% of gross salary from the employee with no cap. Both are statutory deductions in Zambia, calculated separately from PAYE income tax.",
      },
    },
    {
      "@type": "Question",
      name: "How should a driver advance be deducted from pay?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An advance recovery is typically deducted after statutory deductions (NAPSA, PAYE, NHIMA) are taken from gross pay, and should never exceed either the outstanding advance balance or what's left of the driver's net pay for that period.",
      },
    },
  ],
};

export default function DriverPayPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <DriverPayCalculator />
    </>
  );
}
