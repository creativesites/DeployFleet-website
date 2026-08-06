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

export interface PayeBand {
  /** Lower bound of this band, ZMW/month. */
  fromZmw: number;
  /** Upper bound, or null for the top, unbounded band. */
  toZmw: number | null;
  rate: number;
}

export const PAYE_BANDS: SourcedValue<PayeBand[]> = {
  value: [
    { fromZmw: 0, toZmw: 5100, rate: 0 },
    { fromZmw: 5100, toZmw: 7100, rate: 0.25 },
    { fromZmw: 7100, toZmw: 9900, rate: 0.3 },
    { fromZmw: 9900, toZmw: null, rate: 0.375 },
  ],
  source: "ZRA PAYE bands, cross-checked against two independent 2026 payroll guides",
  asOf: "2026-04-16",
  confidence: "medium",
  note: "zra.org.zm's own PAYE calculator and published PDF were unreachable (503) while sourcing this — cross-verified instead against two independent Zambian payroll-guide sites that agree on these exact bands. Confirm against ZRA directly before relying on this for a real payslip. Bands apply progressively: an employee's income is taxed band-by-band, not at one flat rate on the full amount. NAPSA (employee share) is deducted before PAYE is calculated; NHIMA is not.",
};

export interface NhimaRate {
  employeeRate: number;
}

export const NHIMA: SourcedValue<NhimaRate> = {
  value: { employeeRate: 0.01 },
  source: "NHIMA Act contribution rate, cross-checked against two independent 2026 payroll guides",
  asOf: "2026-04-16",
  confidence: "medium",
  note: "1% of gross salary, no ceiling — unlike NAPSA. Same ZRA-site-unreachable caveat as PAYE_BANDS above.",
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

export interface AxleLoadLimits {
  steeringSingleKg: number;
  driveSingleKg: number;
  tandemKg: number;
  tridemKg: number;
  /** Fraction of the legal limit allowed before a group is flagged overloaded, e.g. 0.05 for 5%. */
  toleranceFraction: number;
  gvmAt6AxlesKg: number;
  gvmAt7PlusAxlesKg: number;
}

export const AXLE_LOAD_LIMITS: SourcedValue<AxleLoadLimits> = {
  value: {
    steeringSingleKg: 8000,
    driveSingleKg: 10000,
    tandemKg: 18000,
    tridemKg: 24000,
    toleranceFraction: 0.05,
    gvmAt6AxlesKg: 48000,
    gvmAt7PlusAxlesKg: 56000,
  },
  source: "COMESA-EAC-SADC Tripartite harmonized axle load limits, cross-checked against Zambia-specific GVM figures",
  asOf: "2026-08-06",
  confidence: "medium",
  note: "Zambia's RTSA does not publish a reachable online copy of its own axle-load schedule (its downloads page and related regional PDFs returned 403/503 while sourcing this). These per-axle-group limits come from the EAC Vehicle Load Control Act, the same harmonized Tripartite (COMESA-EAC-SADC) framework Zambia operates under as a member state — cross-checked against an independently sourced Zambia-specific figure (48-tonne GVM at 6 axles, 56-tonne GVM at 7+ axles) that matches the harmonized ceiling exactly. The 5% tolerance is the same allowance the source framework grants for in-transit cargo shift. Confirm against RTSA directly before relying on this for a real compliance decision — this is regulatory, safety-relevant data, treat it as a starting point, not a citation.",
};
