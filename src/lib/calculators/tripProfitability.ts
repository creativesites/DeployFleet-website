/**
 * Trip Profitability — Layer 1 deterministic engine.
 *
 * Answers one question for a single trip: after every real cost, does
 * this load make money, and at what rate does it stop being worth
 * taking? Pure function, no network calls, no AI, country-agnostic — see
 * costPerKm.ts for the same discipline applied to a fleet-wide figure
 * instead of one trip.
 */

export type RevenueMode = "perKm" | "lumpSum";

export interface TripProfitabilityInputs {
  distanceKm: number;
  revenueMode: RevenueMode;
  ratePerKm: number;
  lumpSum: number;
  fuelPricePerLitre: number;
  fuelConsumptionLPer100Km: number;
  driverAllowance: number;
  tolls: number;
  borderFees: number;
  tyresPerKm: number;
  maintenanceReservePerKm: number;
  otherCosts: number;
}

export type ProfitabilityStatus = "healthy" | "thin-margin" | "loss";

export interface CostBreakdownItem {
  label: string;
  amount: number;
  share: number;
}

export interface TripProfitabilityResult {
  totalRevenue: number;
  fuelCost: number;
  distanceCost: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  profitPerKm: number;
  breakEvenRatePerKm: number;
  status: ProfitabilityStatus;
  breakdown: CostBreakdownItem[];
}

const HEALTHY_MARGIN_THRESHOLD = 0.15;

function statusFor(marginPercent: number): ProfitabilityStatus {
  if (marginPercent < 0) return "loss";
  if (marginPercent < HEALTHY_MARGIN_THRESHOLD * 100) return "thin-margin";
  return "healthy";
}

export function calculateTripProfitability(inputs: TripProfitabilityInputs): TripProfitabilityResult {
  const totalRevenue = inputs.revenueMode === "perKm" ? inputs.ratePerKm * inputs.distanceKm : inputs.lumpSum;

  const fuelCost = (inputs.fuelConsumptionLPer100Km / 100) * inputs.distanceKm * inputs.fuelPricePerLitre;
  const distanceCost = (inputs.tyresPerKm + inputs.maintenanceReservePerKm) * inputs.distanceKm;

  const totalCost = fuelCost + distanceCost + inputs.driverAllowance + inputs.tolls + inputs.borderFees + inputs.otherCosts;

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const profitPerKm = inputs.distanceKm > 0 ? grossProfit / inputs.distanceKm : 0;
  const breakEvenRatePerKm = inputs.distanceKm > 0 ? totalCost / inputs.distanceKm : 0;

  const rawBreakdown: [string, number][] = [
    ["Fuel", fuelCost],
    ["Tyres & maintenance", distanceCost],
    ["Driver allowance", inputs.driverAllowance],
    ["Tolls", inputs.tolls],
    ["Border fees", inputs.borderFees],
    ["Other", inputs.otherCosts],
  ];

  const breakdown: CostBreakdownItem[] = rawBreakdown.map(([label, amount]) => ({
    label,
    amount,
    share: totalCost > 0 ? amount / totalCost : 0,
  }));

  return {
    totalRevenue,
    fuelCost,
    distanceCost,
    totalCost,
    grossProfit,
    profitMarginPercent,
    profitPerKm,
    breakEvenRatePerKm,
    status: statusFor(profitMarginPercent),
    breakdown,
  };
}
