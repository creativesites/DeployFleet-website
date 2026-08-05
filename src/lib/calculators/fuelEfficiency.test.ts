import { describe, expect, it } from "vitest";
import { calculateFuelEfficiency, type FuelEfficiencyInputs } from "./fuelEfficiency";

const baseInputs: FuelEfficiencyInputs = {
  distanceKm: 1000,
  actualFuelUsedLitres: 380,
  expectedConsumptionLPer100Km: 38,
  fuelPriceZmwPerLitre: 26.86,
};

describe("calculateFuelEfficiency", () => {
  it("computes actual consumption per 100km from litres used and distance", () => {
    const result = calculateFuelEfficiency(baseInputs);
    expect(result.actualConsumptionLPer100Km).toBeCloseTo(38, 5);
  });

  it("flags normal when actual matches expected exactly", () => {
    const result = calculateFuelEfficiency(baseInputs);
    expect(result.variancePercent).toBeCloseTo(0, 5);
    expect(result.flag).toBe("normal");
  });

  it("flags above-expected between 10% and 20% over", () => {
    // Expected fuel for 1000km @ 38L/100km = 380L. 15% over = 437L.
    const result = calculateFuelEfficiency({ ...baseInputs, actualFuelUsedLitres: 437 });
    expect(result.variancePercent).toBeCloseTo(15, 1);
    expect(result.flag).toBe("above-expected");
  });

  it("flags significantly-above-expected at 20% or more over", () => {
    const result = calculateFuelEfficiency({ ...baseInputs, actualFuelUsedLitres: 380 * 1.25 });
    expect(result.variancePercent).toBeCloseTo(25, 1);
    expect(result.flag).toBe("significantly-above-expected");
  });

  it("flags below-expected when consumption is notably lower than the baseline", () => {
    const result = calculateFuelEfficiency({ ...baseInputs, actualFuelUsedLitres: 380 * 0.85 });
    expect(result.variancePercent).toBeLessThanOrEqual(-10);
    expect(result.flag).toBe("below-expected");
  });

  it("computes cost variance from the litre variance and fuel price", () => {
    const result = calculateFuelEfficiency({ ...baseInputs, actualFuelUsedLitres: 437 });
    expect(result.costVarianceZmw).toBeCloseTo(57 * 26.86, 5);
  });

  it("never divides by zero when distance or expected consumption is 0", () => {
    const zeroDistance = calculateFuelEfficiency({ ...baseInputs, distanceKm: 0 });
    expect(zeroDistance.actualConsumptionLPer100Km).toBe(0);
    expect(Number.isFinite(zeroDistance.variancePercent)).toBe(true);

    const zeroExpected = calculateFuelEfficiency({ ...baseInputs, expectedConsumptionLPer100Km: 0 });
    expect(zeroExpected.variancePercent).toBe(0);
  });

  it("is deterministic", () => {
    expect(calculateFuelEfficiency(baseInputs)).toEqual(calculateFuelEfficiency(baseInputs));
  });
});
