"use client";

import { motion } from "framer-motion";

export type GaugeStatus = "healthy" | "warning" | "danger";

const STATUS_COLOR: Record<GaugeStatus, string> = {
  healthy: "var(--df-emerald)",
  warning: "var(--df-amber)",
  danger: "var(--df-danger)",
};

/**
 * The "visual health" layer — a segmented horizontal bar rather than a
 * radial dial (cheaper to build well, reads faster on a narrow mobile
 * card, still unmistakably "a gauge"). Uses the design system's existing
 * emerald/amber/danger tokens — no new colors invented for this. Width
 * and color both transition on change via a spring, not an instant jump.
 */
export function HealthGauge({ percent, status }: { percent: number; status: GaugeStatus }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full"
      style={{ background: "var(--df-border)" }}
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        initial={false}
        animate={{ width: `${clamped}%`, backgroundColor: STATUS_COLOR[status] }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      />
    </div>
  );
}
