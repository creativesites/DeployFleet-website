/**
 * Cost Per Kilometre — Layer 1 deterministic engine.
 *
 * Pure function: same inputs always produce the same outputs, no network
 * calls, no dependency on AI. This is the source of truth the calculator
 * page renders — see the Intelligence Hub plan §01/§03.
 */

export interface FixedCostsMonthlyZmw {
  insurance: number;
  napsa: number;
  licensing: number;
  financing: number;
  yardRent: number;
}

export interface VariableCostsPerKmZmw {
  tyres: number;
  maintenanceReserve: number;
}

export interface CostPerKmInputs {
  annualDistanceKm: number;
  fuelPriceZmwPerLitre: number;
  fuelConsumptionLPer100Km: number;
  fixedCostsMonthlyZmw: FixedCostsMonthlyZmw;
  variableCostsPerKmZmw: VariableCostsPerKmZmw;
  driverWagesMonthlyZmw: number;
  tollsMonthlyZmw: number;
}

export interface CostBreakdownItem {
  label: string;
  perKmZmw: number;
  /** 0–1 share of total cost per km. */
  share: number;
}

export interface CostPerKmResult {
  fuelCostPerKmZmw: number;
  fixedCostPerKmZmw: number;
  variableCostPerKmZmw: number;
  driverCostPerKmZmw: number;
  tollCostPerKmZmw: number;
  totalCostPerKmZmw: number;
  monthlyDistanceKm: number;
  annualTotalCostZmw: number;
  breakdown: CostBreakdownItem[];
}

function sumFixedCosts(costs: FixedCostsMonthlyZmw): number {
  return costs.insurance + costs.napsa + costs.licensing + costs.financing + costs.yardRent;
}

export function calculateCostPerKm(inputs: CostPerKmInputs): CostPerKmResult {
  const monthlyDistanceKm = inputs.annualDistanceKm / 12;
  const hasDistance = monthlyDistanceKm > 0;

  const fuelCostPerKmZmw = (inputs.fuelConsumptionLPer100Km / 100) * inputs.fuelPriceZmwPerLitre;

  const fixedCostsMonthlyTotal = sumFixedCosts(inputs.fixedCostsMonthlyZmw);
  const fixedCostPerKmZmw = hasDistance ? fixedCostsMonthlyTotal / monthlyDistanceKm : 0;

  const variableCostPerKmZmw =
    inputs.variableCostsPerKmZmw.tyres + inputs.variableCostsPerKmZmw.maintenanceReserve;

  const driverCostPerKmZmw = hasDistance ? inputs.driverWagesMonthlyZmw / monthlyDistanceKm : 0;

  const tollCostPerKmZmw = hasDistance ? inputs.tollsMonthlyZmw / monthlyDistanceKm : 0;

  const totalCostPerKmZmw =
    fuelCostPerKmZmw +
    fixedCostPerKmZmw +
    variableCostPerKmZmw +
    driverCostPerKmZmw +
    tollCostPerKmZmw;

  const rawBreakdown: [string, number][] = [
    ["Fuel", fuelCostPerKmZmw],
    ["Fixed costs", fixedCostPerKmZmw],
    ["Tyres & maintenance", variableCostPerKmZmw],
    ["Driver wages", driverCostPerKmZmw],
    ["Tolls", tollCostPerKmZmw],
  ];

  const breakdown: CostBreakdownItem[] = rawBreakdown.map(([label, perKmZmw]) => ({
    label,
    perKmZmw,
    share: totalCostPerKmZmw > 0 ? perKmZmw / totalCostPerKmZmw : 0,
  }));

  return {
    fuelCostPerKmZmw,
    fixedCostPerKmZmw,
    variableCostPerKmZmw,
    driverCostPerKmZmw,
    tollCostPerKmZmw,
    totalCostPerKmZmw,
    monthlyDistanceKm,
    annualTotalCostZmw: totalCostPerKmZmw * inputs.annualDistanceKm,
    breakdown,
  };
}
