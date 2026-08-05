/**
 * Trip Profitability — Layer 1 deterministic engine.
 *
 * Answers one question for a single trip: after every real cost, does
 * this load make money, and at what rate does it stop being worth
 * taking? Pure function, no network calls, no AI — see costPerKm.ts for
 * the same discipline applied to a fleet-wide figure instead of one trip.
 */

export type RevenueMode = "perKm" | "lumpSum";

export interface TripProfitabilityInputs {
  distanceKm: number;
  revenueMode: RevenueMode;
  ratePerKmZmw: number;
  lumpSumZmw: number;
  fuelPriceZmwPerLitre: number;
  fuelConsumptionLPer100Km: number;
  driverAllowanceZmw: number;
  tollsZmw: number;
  borderFeesZmw: number;
  tyresPerKmZmw: number;
  maintenanceReservePerKmZmw: number;
  otherCostsZmw: number;
}

export type ProfitabilityStatus = "healthy" | "thin-margin" | "loss";

export interface CostBreakdownItem {
  label: string;
  amountZmw: number;
  share: number;
}

export interface TripProfitabilityResult {
  totalRevenueZmw: number;
  fuelCostZmw: number;
  distanceCostZmw: number;
  totalCostZmw: number;
  grossProfitZmw: number;
  profitMarginPercent: number;
  profitPerKmZmw: number;
  breakEvenRatePerKmZmw: number;
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
  const totalRevenueZmw =
    inputs.revenueMode === "perKm" ? inputs.ratePerKmZmw * inputs.distanceKm : inputs.lumpSumZmw;

  const fuelCostZmw = (inputs.fuelConsumptionLPer100Km / 100) * inputs.distanceKm * inputs.fuelPriceZmwPerLitre;
  const distanceCostZmw = (inputs.tyresPerKmZmw + inputs.maintenanceReservePerKmZmw) * inputs.distanceKm;

  const totalCostZmw =
    fuelCostZmw +
    distanceCostZmw +
    inputs.driverAllowanceZmw +
    inputs.tollsZmw +
    inputs.borderFeesZmw +
    inputs.otherCostsZmw;

  const grossProfitZmw = totalRevenueZmw - totalCostZmw;
  const profitMarginPercent = totalRevenueZmw > 0 ? (grossProfitZmw / totalRevenueZmw) * 100 : 0;
  const profitPerKmZmw = inputs.distanceKm > 0 ? grossProfitZmw / inputs.distanceKm : 0;
  const breakEvenRatePerKmZmw = inputs.distanceKm > 0 ? totalCostZmw / inputs.distanceKm : 0;

  const rawBreakdown: [string, number][] = [
    ["Fuel", fuelCostZmw],
    ["Tyres & maintenance", distanceCostZmw],
    ["Driver allowance", inputs.driverAllowanceZmw],
    ["Tolls", inputs.tollsZmw],
    ["Border fees", inputs.borderFeesZmw],
    ["Other", inputs.otherCostsZmw],
  ];

  const breakdown: CostBreakdownItem[] = rawBreakdown.map(([label, amountZmw]) => ({
    label,
    amountZmw,
    share: totalCostZmw > 0 ? amountZmw / totalCostZmw : 0,
  }));

  return {
    totalRevenueZmw,
    fuelCostZmw,
    distanceCostZmw,
    totalCostZmw,
    grossProfitZmw,
    profitMarginPercent,
    profitPerKmZmw,
    breakEvenRatePerKmZmw,
    status: statusFor(profitMarginPercent),
    breakdown,
  };
}
