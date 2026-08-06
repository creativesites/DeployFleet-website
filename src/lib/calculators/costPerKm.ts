/**
 * Cost Per Kilometre — Layer 1 deterministic engine.
 *
 * Pure function: same inputs always produce the same outputs, no network
 * calls, no dependency on AI. Country-agnostic — every amount is in
 * whatever currency the caller's inputs are denominated in; see
 * `src/lib/countries.ts` for the per-country data (diesel price, tolls,
 * social security rate) a calling component supplies.
 */

export interface FixedCostsMonthly {
  insurance: number;
  socialSecurity: number;
  licensing: number;
  financing: number;
  yardRent: number;
}

export interface VariableCostsPerKm {
  tyres: number;
  maintenanceReserve: number;
}

export interface CostPerKmInputs {
  annualDistanceKm: number;
  fuelPricePerLitre: number;
  fuelConsumptionLPer100Km: number;
  fixedCostsMonthly: FixedCostsMonthly;
  variableCostsPerKm: VariableCostsPerKm;
  driverWagesMonthly: number;
  tollsMonthly: number;
}

export interface CostBreakdownItem {
  label: string;
  perKm: number;
  /** 0–1 share of total cost per km. */
  share: number;
}

export interface CostPerKmResult {
  fuelCostPerKm: number;
  fixedCostPerKm: number;
  variableCostPerKm: number;
  driverCostPerKm: number;
  tollCostPerKm: number;
  totalCostPerKm: number;
  monthlyDistanceKm: number;
  annualTotalCost: number;
  breakdown: CostBreakdownItem[];
}

function sumFixedCosts(costs: FixedCostsMonthly): number {
  return costs.insurance + costs.socialSecurity + costs.licensing + costs.financing + costs.yardRent;
}

export function calculateCostPerKm(inputs: CostPerKmInputs): CostPerKmResult {
  const monthlyDistanceKm = inputs.annualDistanceKm / 12;
  const hasDistance = monthlyDistanceKm > 0;

  const fuelCostPerKm = (inputs.fuelConsumptionLPer100Km / 100) * inputs.fuelPricePerLitre;

  const fixedCostsMonthlyTotal = sumFixedCosts(inputs.fixedCostsMonthly);
  const fixedCostPerKm = hasDistance ? fixedCostsMonthlyTotal / monthlyDistanceKm : 0;

  const variableCostPerKm = inputs.variableCostsPerKm.tyres + inputs.variableCostsPerKm.maintenanceReserve;

  const driverCostPerKm = hasDistance ? inputs.driverWagesMonthly / monthlyDistanceKm : 0;

  const tollCostPerKm = hasDistance ? inputs.tollsMonthly / monthlyDistanceKm : 0;

  const totalCostPerKm = fuelCostPerKm + fixedCostPerKm + variableCostPerKm + driverCostPerKm + tollCostPerKm;

  const rawBreakdown: [string, number][] = [
    ["Fuel", fuelCostPerKm],
    ["Fixed costs", fixedCostPerKm],
    ["Tyres & maintenance", variableCostPerKm],
    ["Driver wages", driverCostPerKm],
    ["Tolls", tollCostPerKm],
  ];

  const breakdown: CostBreakdownItem[] = rawBreakdown.map(([label, perKm]) => ({
    label,
    perKm,
    share: totalCostPerKm > 0 ? perKm / totalCostPerKm : 0,
  }));

  return {
    fuelCostPerKm,
    fixedCostPerKm,
    variableCostPerKm,
    driverCostPerKm,
    tollCostPerKm,
    totalCostPerKm,
    monthlyDistanceKm,
    annualTotalCost: totalCostPerKm * inputs.annualDistanceKm,
    breakdown,
  };
}
