/**
 * Fuel Cost & Efficiency — Layer 1 deterministic engine.
 *
 * Compares actual logged fuel use against the fleet's own expected
 * consumption baseline for the same distance, and flags how far apart
 * they are. Pure function — the anomaly flag is a fixed threshold rule,
 * not an AI judgement; see the Intelligence Hub plan §05 UX ladder for
 * where a real explanation of *why* eventually belongs (Layer 2).
 */

export interface FuelEfficiencyInputs {
  distanceKm: number;
  actualFuelUsedLitres: number;
  expectedConsumptionLPer100Km: number;
  fuelPriceZmwPerLitre: number;
}

export type ConsumptionFlag = "below-expected" | "normal" | "above-expected" | "significantly-above-expected";

export interface FuelEfficiencyResult {
  actualConsumptionLPer100Km: number;
  expectedFuelLitres: number;
  varianceLitres: number;
  variancePercent: number;
  actualCostZmw: number;
  expectedCostZmw: number;
  costVarianceZmw: number;
  flag: ConsumptionFlag;
}

const ABOVE_EXPECTED_THRESHOLD_PERCENT = 10;
const SIGNIFICANTLY_ABOVE_THRESHOLD_PERCENT = 20;
const BELOW_EXPECTED_THRESHOLD_PERCENT = -10;

function flagFor(variancePercent: number): ConsumptionFlag {
  if (variancePercent >= SIGNIFICANTLY_ABOVE_THRESHOLD_PERCENT) return "significantly-above-expected";
  if (variancePercent >= ABOVE_EXPECTED_THRESHOLD_PERCENT) return "above-expected";
  if (variancePercent <= BELOW_EXPECTED_THRESHOLD_PERCENT) return "below-expected";
  return "normal";
}

export function calculateFuelEfficiency(inputs: FuelEfficiencyInputs): FuelEfficiencyResult {
  const actualConsumptionLPer100Km =
    inputs.distanceKm > 0 ? (inputs.actualFuelUsedLitres / inputs.distanceKm) * 100 : 0;

  const expectedFuelLitres = (inputs.expectedConsumptionLPer100Km / 100) * inputs.distanceKm;
  const varianceLitres = inputs.actualFuelUsedLitres - expectedFuelLitres;
  const variancePercent = expectedFuelLitres > 0 ? (varianceLitres / expectedFuelLitres) * 100 : 0;

  const actualCostZmw = inputs.actualFuelUsedLitres * inputs.fuelPriceZmwPerLitre;
  const expectedCostZmw = expectedFuelLitres * inputs.fuelPriceZmwPerLitre;
  const costVarianceZmw = actualCostZmw - expectedCostZmw;

  return {
    actualConsumptionLPer100Km,
    expectedFuelLitres,
    varianceLitres,
    variancePercent,
    actualCostZmw,
    expectedCostZmw,
    costVarianceZmw,
    flag: flagFor(variancePercent),
  };
}
