import type { Metadata } from "next";
import DemoGate from "@/components/DemoGate";

export const metadata: Metadata = {
  title: "Explore the Live Demo",
  description:
    "Jump straight into a live, running DeployFleet instance — one-click login for the Owner, Dispatcher, and Driver views.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
      <span className="section-eyebrow justify-center">Live demo</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
        See the real thing, right now.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-body">
        This isn&apos;t a sandbox with fake data bolted on afterwards — it&apos;s
        a live DeployFleet instance running a full demo fleet. Tell us a
        little about yours below, and you&apos;re in — no account to
        create, no password to remember.
      </p>

      <DemoGate />
    </div>
  );
}
