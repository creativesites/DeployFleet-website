import type { Metadata } from "next";
import ProductPageLayout from "@/components/ProductPageLayout";

export const metadata: Metadata = {
  title: "Dispatch & Driver Management",
  description:
    "Match the right driver and truck to every load in one tap, with compliance checked automatically before a shipment is confirmed.",
};

export default function DispatchPage() {
  return (
    <ProductPageLayout
      eyebrow="Dispatch & Driver Management"
      title="Which load should go next? Answered in one tap."
      intro="The Dispatch Board replaces phone calls and WhatsApp voice notes with a single working view: every shipment waiting on assignment, ranked driver and truck suggestions, and a one-tap confirm — with compliance checked before it happens, not after."
      screenshotLabel="Dispatch Board — shipment queue and trip board"
      screenshotSrc="/screenshots/dispatch-board.png"
      features={[
        {
          title: "Ranked suggestions, not a blank form",
          body: "Every shipment surfaces its best-matched drivers and trucks automatically, scored against availability, compliance, and history — you confirm, you don't hunt.",
        },
        {
          title: "Compliance checked at the point of dispatch",
          body: "A driver on leave or a truck with an expired document is flagged before assignment, with a logged, accountable override for genuine emergencies — never a silent bypass.",
        },
        {
          title: "Built for a phone in one hand, a shipment list in the other",
          body: "Tap-to-assign, not drag-and-drop — designed for dispatchers working from a tablet or phone, not a desk.",
        },
        {
          title: "One view, every state",
          body: "Draft, confirmed, assigned, in transit, delivered — the full lifecycle of a shipment lives in one place, not scattered across separate screens.",
        },
      ]}
    />
  );
}
