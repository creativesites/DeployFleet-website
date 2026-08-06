import { describe, expect, it } from "vitest";
import { calculateFleetTco, type FleetTcoInputs } from "./fleetTco";

describe("calculateFleetTco", () => {
  it("computes year-1 operating cost, cumulative cost, resale, and net cost of ownership", () => {
    const inputs: FleetTcoInputs = {
      purchasePriceZmw: 800_000,
      annualDistanceKm: 120_000,
      fuelCostPerKmZmw: 5,
      annualMaintenanceTyresZmw: 40_000,
      maintenanceGrowthRatePerYear: 0.1,
      annualInsuranceLicensingZmw: 30_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.15,
      horizonYears: 5,
    };
    const result = calculateFleetTco(inputs);
    const year1 = result.years[0];
    expect(year1.operatingCostThisYearZmw).toBeCloseTo(670_000, 1);
    expect(year1.cumulativeCostZmw).toBeCloseTo(1_470_000, 1);
    expect(year1.resaleValueZmw).toBeCloseTo(680_000, 1);
    expect(year1.netCostOfOwnershipZmw).toBeCloseTo(790_000, 1);
    expect(year1.costPerYearZmw).toBeCloseTo(790_000, 1);
  });

  it("grows maintenance cost year over year at the given rate", () => {
    const inputs: FleetTcoInputs = {
      purchasePriceZmw: 800_000,
      annualDistanceKm: 120_000,
      fuelCostPerKmZmw: 5,
      annualMaintenanceTyresZmw: 40_000,
      maintenanceGrowthRatePerYear: 0.1,
      annualInsuranceLicensingZmw: 30_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.15,
      horizonYears: 3,
    };
    const result = calculateFleetTco(inputs);
    // year 2 operating cost should be 600,000 (fuel) + 30,000 (insurance) + 44,000 (maintenance*1.1)
    expect(result.years[1].operatingCostThisYearZmw).toBeCloseTo(674_000, 1);
  });

  it("never lets resale value fall below the 5% floor of the purchase price", () => {
    const inputs: FleetTcoInputs = {
      purchasePriceZmw: 500_000,
      annualDistanceKm: 100_000,
      fuelCostPerKmZmw: 4,
      annualMaintenanceTyresZmw: 10_000,
      maintenanceGrowthRatePerYear: 0.1,
      annualInsuranceLicensingZmw: 20_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.9,
      horizonYears: 10,
    };
    const result = calculateFleetTco(inputs);
    for (const y of result.years) {
      expect(y.resaleValueZmw).toBeGreaterThanOrEqual(25_000 - 0.01);
    }
  });

  it("identifies a genuine interior minimum as the optimal replacement year", () => {
    const inputs: FleetTcoInputs = {
      purchasePriceZmw: 500_000,
      annualDistanceKm: 100_000,
      fuelCostPerKmZmw: 4,
      annualMaintenanceTyresZmw: 10_000,
      maintenanceGrowthRatePerYear: 0.5,
      annualInsuranceLicensingZmw: 20_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.2,
      horizonYears: 8,
    };
    const result = calculateFleetTco(inputs);
    expect(result.optimalReplacementYear).toBe(5);
    expect(result.years[4].costPerYearZmw).toBeCloseTo(513_607, -1);
    // the minimum should genuinely be lower than both neighbours, not just the last data point
    expect(result.years[4].costPerYearZmw).toBeLessThan(result.years[3].costPerYearZmw);
    expect(result.years[4].costPerYearZmw).toBeLessThan(result.years[5].costPerYearZmw);
  });

  it("returns an empty projection for a zero-year horizon", () => {
    const result = calculateFleetTco({
      purchasePriceZmw: 500_000,
      annualDistanceKm: 100_000,
      fuelCostPerKmZmw: 4,
      annualMaintenanceTyresZmw: 10_000,
      maintenanceGrowthRatePerYear: 0.1,
      annualInsuranceLicensingZmw: 20_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.2,
      horizonYears: 0,
    });
    expect(result.years).toHaveLength(0);
    expect(result.optimalReplacementYear).toBe(0);
  });

  it("treats negative cost inputs as zero rather than reducing the total", () => {
    const result = calculateFleetTco({
      purchasePriceZmw: 500_000,
      annualDistanceKm: 100_000,
      fuelCostPerKmZmw: 4,
      annualMaintenanceTyresZmw: -10_000,
      maintenanceGrowthRatePerYear: 0.1,
      annualInsuranceLicensingZmw: -20_000,
      annualFinancingCostZmw: 0,
      annualDepreciationRate: 0.2,
      horizonYears: 1,
    });
    expect(result.years[0].operatingCostThisYearZmw).toBeCloseTo(400_000, 1);
  });
});
