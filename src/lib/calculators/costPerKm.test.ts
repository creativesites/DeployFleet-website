import { describe, expect, it } from "vitest";
import { calculateCostPerKm, type CostPerKmInputs } from "./costPerKm";

const baseInputs: CostPerKmInputs = {
  annualDistanceKm: 120_000, // 10,000 km/month
  fuelPriceZmwPerLitre: 26.86,
  fuelConsumptionLPer100Km: 38,
  fixedCostsMonthlyZmw: {
    insurance: 3000,
    napsa: 1861.8,
    licensing: 500,
    financing: 8000,
    yardRent: 1000,
  },
  variableCostsPerKmZmw: {
    tyres: 0.9,
    maintenanceReserve: 0.6,
  },
  driverWagesMonthlyZmw: 8500,
  tollsMonthlyZmw: 2400,
};

describe("calculateCostPerKm", () => {
  it("computes fuel cost per km from consumption and price", () => {
    const result = calculateCostPerKm(baseInputs);
    // 38 L/100km at K26.86/L = 0.38 * 26.86
    expect(result.fuelCostPerKmZmw).toBeCloseTo(10.2068, 3);
  });

  it("spreads monthly fixed costs across the monthly distance", () => {
    const result = calculateCostPerKm(baseInputs);
    const fixedMonthlyTotal = 3000 + 1861.8 + 500 + 8000 + 1000;
    expect(result.monthlyDistanceKm).toBe(10_000);
    expect(result.fixedCostPerKmZmw).toBeCloseTo(fixedMonthlyTotal / 10_000, 5);
  });

  it("sums every component into the total, matching a manual total", () => {
    const result = calculateCostPerKm(baseInputs);
    const manualTotal =
      result.fuelCostPerKmZmw +
      result.fixedCostPerKmZmw +
      result.variableCostPerKmZmw +
      result.driverCostPerKmZmw +
      result.tollCostPerKmZmw;
    expect(result.totalCostPerKmZmw).toBeCloseTo(manualTotal, 10);
  });

  it("scales annual total cost from the per-km total and annual distance", () => {
    const result = calculateCostPerKm(baseInputs);
    expect(result.annualTotalCostZmw).toBeCloseTo(
      result.totalCostPerKmZmw * baseInputs.annualDistanceKm,
      6
    );
  });

  it("breakdown shares sum to 1 when total cost is positive", () => {
    const result = calculateCostPerKm(baseInputs);
    const totalShare = result.breakdown.reduce((sum, item) => sum + item.share, 0);
    expect(totalShare).toBeCloseTo(1, 10);
  });

  it("never divides by zero when annual distance is 0", () => {
    const result = calculateCostPerKm({ ...baseInputs, annualDistanceKm: 0 });
    expect(result.monthlyDistanceKm).toBe(0);
    expect(result.fixedCostPerKmZmw).toBe(0);
    expect(result.driverCostPerKmZmw).toBe(0);
    expect(result.tollCostPerKmZmw).toBe(0);
    // Fuel and variable-per-km costs are independent of distance, so they
    // still compute — only the distance-divided fields zero out.
    expect(result.fuelCostPerKmZmw).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalCostPerKmZmw)).toBe(true);
  });

  it("is deterministic — identical inputs always produce identical output", () => {
    const a = calculateCostPerKm(baseInputs);
    const b = calculateCostPerKm(baseInputs);
    expect(a).toEqual(b);
  });
});
