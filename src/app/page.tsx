import Hero from "@/components/home/Hero";
import ProblemSection from "@/components/home/ProblemSection";
import SolutionSection from "@/components/home/SolutionSection";
import PillarsSection from "@/components/home/PillarsSection";
import HowItWorks from "@/components/home/HowItWorks";
import AiSection from "@/components/home/AiSection";
import TrustSection from "@/components/home/TrustSection";
import CalculatorsSection from "@/components/home/CalculatorsSection";
import ProofSection from "@/components/home/ProofSection";
import CtaSection from "@/components/home/CtaSection";

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <PillarsSection />
      <HowItWorks />
      <AiSection />
      <TrustSection />
      <CalculatorsSection />
      <ProofSection />
      <CtaSection />
    </>
  );
}
