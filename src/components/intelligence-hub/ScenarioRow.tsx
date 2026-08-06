"use client";

import { motion } from "framer-motion";

/**
 * A pure, testable transformation of a calculator's current inputs — tap
 * a chip, the engine re-runs, the hero metric animates to the new value.
 * The single highest-leverage addition beyond the five-layer Control
 * Panel formula: it turns "fill in a form once" into "explore for two
 * extra minutes," which is the actual mechanism behind more time on
 * page, better SEO signals, and more conversions — not a cosmetic add-on.
 */
export interface Scenario<TInputs> {
  label: string;
  apply: (inputs: TInputs) => TInputs;
}

export function ScenarioRow<TInputs>({
  scenarios,
  onApply,
  activeLabel,
}: {
  scenarios: Scenario<TInputs>[];
  onApply: (scenario: Scenario<TInputs>) => void;
  activeLabel?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {scenarios.map((scenario) => {
        const active = activeLabel === scenario.label;
        return (
          <motion.button
            key={scenario.label}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onApply(scenario)}
            className="rounded-full border px-3 py-2 text-xs font-semibold transition-colors"
            style={
              active
                ? {
                    borderColor: "var(--df-teal)",
                    background: "color-mix(in srgb, var(--df-teal) 10%, transparent)",
                    color: "var(--df-navy)",
                  }
                : { borderColor: "var(--df-border)", background: "var(--df-canvas)", color: "var(--df-muted)" }
            }
          >
            {scenario.label}
          </motion.button>
        );
      })}
    </div>
  );
}
