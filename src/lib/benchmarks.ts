/**
 * Real-world reference figures used as calculator defaults and comparison
 * points across the Intelligence Hub. Every value here is sourced and
 * dated — see README.md "Data integrity discipline." Nothing in this file
 * is invented; where a figure genuinely isn't available yet, don't add a
 * placeholder number, leave the field for the user to fill in themselves.
 *
 * Update workflow (locked decision, see the Intelligence Hub plan §11):
 * research happens with the user during a session, sources and dates are
 * confirmed before a value changes here.
 */

export type Confidence = "high" | "medium" | "low";

export interface SourcedValue<T> {
  value: T;
  source: string;
  /** ISO date the figure was confirmed current as of. */
  asOf: string;
  confidence: Confidence;
  note?: string;
}

export function formatSourceLabel(b: SourcedValue<unknown>): string {
  const date = new Date(b.asOf).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Source: ${b.source}, ${date}`;
}

/**
 * Zambian diesel pump price. The Energy Regulation Board reviews this
 * roughly monthly — it ranged K23.25 to K33.99/litre between March and
 * June 2026 alone. Treat this as a snapshot to seed a form field, not a
 * stable constant; the note is shown in the UI for exactly this reason.
 */
export const DIESEL_PRICE_ZMW_PER_LITRE: SourcedValue<number> = {
  value: 26.86,
  source: "Energy Regulation Board (ERB) Zambia",
  asOf: "2026-08-01",
  confidence: "medium",
  note: "Reviewed monthly and has moved by more than K4/litre month-to-month in 2026 — confirm the current price at erb.org.zm before relying on this for a real decision.",
};

export interface NapsaRates {
  employeeRate: number;
  employerRate: number;
  totalRate: number;
  monthlyCeilingZmw: number;
  employeeCapZmw: number;
  employerCapZmw: number;
}

export const NAPSA: SourcedValue<NapsaRates> = {
  value: {
    employeeRate: 0.05,
    employerRate: 0.05,
    totalRate: 0.1,
    monthlyCeilingZmw: 37236,
    employeeCapZmw: 1861.8,
    employerCapZmw: 1861.8,
  },
  source: "National Pension Scheme Authority (NAPSA) 2026 ceiling update",
  asOf: "2026-01-01",
  confidence: "high",
  note: "5% employee + 5% employer, capped at the monthly earnings ceiling — the deduction cannot exceed the cap regardless of actual salary.",
};

export interface HeavyVehicleTolls {
  fourPlusAxleHeavyZmw: number;
  twoToFourAxleMediumHeavyZmw: number;
  abnormalLoadZmw: number;
}

export const HEAVY_VEHICLE_TOLLS: SourcedValue<HeavyVehicleTolls> = {
  value: {
    fourPlusAxleHeavyZmw: 300,
    twoToFourAxleMediumHeavyZmw: 200,
    abnormalLoadZmw: 1000,
  },
  source: "National Road Fund Agency (NRFA) 2026 toll adjustment",
  asOf: "2026-01-01",
  confidence: "high",
  note: "Per single toll-gate passage. A single trip often crosses multiple gates — multiply by the number of gates on the route, not by distance.",
};
