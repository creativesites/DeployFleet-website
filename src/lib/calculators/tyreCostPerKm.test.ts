import { describe, expect, it } from "vitest";
import { calculateTyreCostPerKm, type TyreCostPerKmInputs } from "./tyreCostPerKm";

function baseInputs(overrides: Partial<TyreCostPerKmInputs> = {}): TyreCostPerKmInputs {
  return {
    budget: { purchasePriceZmw: 3500, expectedLifeKm: 60_000, numberOfRetreads: 1, retreadCostZmw: 1500, retreadLifeKm: 40_000 },
    premium: { purchasePriceZmw: 6000, expectedLifeKm: 100_000, numberOfRetreads: 2, retreadCostZmw: 2000, retreadLifeKm: 70_000 },
    tyrePositionsOnVehicle: 10,
    annualDistanceKm: 120_000,
    ...overrides,
  };
}

describe("calculateTyreCostPerKm", () => {
  it("computes total lifecycle km and cost including retreads", () => {
    const result = calculateTyreCostPerKm(baseInputs());
    expect(result.budget.totalLifecycleKm).toBe(100_000);
    expect(result.budget.totalLifecycleCostZmw).toBe(5000);
    expect(result.premium.totalLifecycleKm).toBe(240_000);
    expect(result.premium.totalLifecycleCostZmw).toBe(10_000);
  });

  it("computes cost per km as total cost over total lifecycle km", () => {
    const result = calculateTyreCostPerKm(baseInputs());
    expect(result.budget.costPerKmZmw).toBeCloseTo(0.05);
    expect(result.premium.costPerKmZmw).toBeCloseTo(0.041667, 5);
  });

  it("identifies premium as cheaper when its lifecycle cost per km is lower", () => {
    const result = calculateTyreCostPerKm(baseInputs());
    expect(result.cheaperOption).toBe("premium");
    expect(result.savingsPerKmZmw).toBeGreaterThan(0);
  });

  it("identifies budget as cheaper when the numbers flip", () => {
    const result = calculateTyreCostPerKm(
      baseInputs({ premium: { purchasePriceZmw: 9000, expectedLifeKm: 80_000, numberOfRetreads: 0, retreadCostZmw: 0, retreadLifeKm: 0 } })
    );
    expect(result.cheaperOption).toBe("budget");
    expect(result.savingsPerKmZmw).toBeLessThan(0);
  });

  it("reports equal when both options land on the same cost per km", () => {
    const same: TyreCostPerKmInputs["budget"] = {
      purchasePriceZmw: 4000,
      expectedLifeKm: 80_000,
      numberOfRetreads: 0,
      retreadCostZmw: 0,
      retreadLifeKm: 0,
    };
    const result = calculateTyreCostPerKm(baseInputs({ budget: same, premium: same }));
    expect(result.cheaperOption).toBe("equal");
    expect(result.savingsPerKmZmw).toBe(0);
  });

  it("scales annual cost per vehicle by distance and tyre position count", () => {
    const result = calculateTyreCostPerKm(baseInputs());
    // 0.05 ZMW/km * 120,000 km/year * 10 positions
    expect(result.budget.annualCostPerVehicleZmw).toBeCloseTo(60_000);
  });

  it("computes annual savings per vehicle as the difference in annual cost", () => {
    const result = calculateTyreCostPerKm(baseInputs());
    expect(result.annualSavingsPerVehicleZmw).toBeCloseTo(
      result.budget.annualCostPerVehicleZmw - result.premium.annualCostPerVehicleZmw
    );
  });

  it("guards against dividing by zero when lifecycle km is zero", () => {
    const result = calculateTyreCostPerKm(
      baseInputs({
        budget: { purchasePriceZmw: 3000, expectedLifeKm: 0, numberOfRetreads: 0, retreadCostZmw: 0, retreadLifeKm: 0 },
      })
    );
    expect(result.budget.costPerKmZmw).toBe(0);
    expect(Number.isFinite(result.budget.costPerKmZmw)).toBe(true);
  });

  it("handles zero retreads as a simple single-lifecycle tyre", () => {
    const result = calculateTyreCostPerKm(
      baseInputs({
        budget: { purchasePriceZmw: 4000, expectedLifeKm: 80_000, numberOfRetreads: 0, retreadCostZmw: 1500, retreadLifeKm: 40_000 },
      })
    );
    expect(result.budget.totalLifecycleKm).toBe(80_000);
    expect(result.budget.totalLifecycleCostZmw).toBe(4000);
  });
});
