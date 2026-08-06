import { describe, expect, it } from "vitest";
import { calculateBreakEvenUtilisation, type BreakEvenUtilisationInputs } from "./breakEvenUtilisation";

function baseInputs(overrides: Partial<BreakEvenUtilisationInputs> = {}): BreakEvenUtilisationInputs {
  return {
    numberOfTrucks: 4,
    fixedCostsMonthlyZmwPerTruck: 15_000,
    variableCostPerKmZmw: 6,
    revenuePerKmZmw: 10,
    maxKmPerTruckPerMonth: 8_000,
    actualKmPerTruckPerMonth: 5_000,
    rampUpMonths: 0,
    projectionMonths: 3,
    ...overrides,
  };
}

describe("calculateBreakEvenUtilisation", () => {
  it("computes break-even km and utilisation from the contribution margin", () => {
    const result = calculateBreakEvenUtilisation(baseInputs());
    expect(result.contributionMarginPerKmZmw).toBeCloseTo(4);
    expect(result.breakEvenKmPerTruckPerMonth).toBeCloseTo(3_750);
    expect(result.breakEvenUtilisationPercent).toBeCloseTo(46.875);
  });

  it("compares actual utilisation against break-even and flags status", () => {
    const result = calculateBreakEvenUtilisation(baseInputs());
    expect(result.currentUtilisationPercent).toBeCloseTo(62.5);
    expect(result.surplusKmPerTruckPerMonth).toBeCloseTo(1_250);
    expect(result.status).toBe("above-break-even");
  });

  it("flags below-break-even when actual km trails the break-even point", () => {
    const result = calculateBreakEvenUtilisation(baseInputs({ actualKmPerTruckPerMonth: 2_000 }));
    expect(result.status).toBe("below-break-even");
    expect(result.monthlyFleetProfitAtCurrentUtilisationZmw).toBeLessThan(0);
  });

  it("computes fleet-wide monthly profit at current utilisation", () => {
    const result = calculateBreakEvenUtilisation(baseInputs());
    // 4 trucks * (5000km * K4 margin - K15,000 fixed) = 4 * 5,000 = K20,000
    expect(result.monthlyFleetProfitAtCurrentUtilisationZmw).toBeCloseTo(20_000);
  });

  it("projects flat monthly cash flow with no ramp-up", () => {
    const result = calculateBreakEvenUtilisation(baseInputs());
    expect(result.monthlyProjection).toHaveLength(3);
    expect(result.monthlyProjection[0].cumulativeCashFlowZmw).toBeCloseTo(20_000);
    expect(result.monthlyProjection[2].cumulativeCashFlowZmw).toBeCloseTo(60_000);
    expect(result.breakEvenMonth).toBe(1);
  });

  it("projects a ramp-up period that delays reaching cumulative break-even", () => {
    const result = calculateBreakEvenUtilisation(baseInputs({ rampUpMonths: 3, projectionMonths: 4 }));
    expect(result.monthlyProjection[0].fleetProfitZmw).toBeLessThan(0);
    expect(result.monthlyProjection[3].cumulativeCashFlowZmw).toBeCloseTo(0, 4);
    expect(result.breakEvenMonth).toBe(4);
  });

  it("treats an unprofitable rate (revenue below variable cost) as never breaking even", () => {
    const result = calculateBreakEvenUtilisation(baseInputs({ revenuePerKmZmw: 5, variableCostPerKmZmw: 6 }));
    expect(result.contributionMarginPerKmZmw).toBeLessThan(0);
    expect(result.breakEvenKmPerTruckPerMonth).toBe(Infinity);
    expect(result.status).toBe("below-break-even");
  });

  it("returns zero utilisation percent rather than dividing by zero when max km is unset", () => {
    const result = calculateBreakEvenUtilisation(baseInputs({ maxKmPerTruckPerMonth: 0 }));
    expect(result.currentUtilisationPercent).toBe(0);
    expect(Number.isNaN(result.currentUtilisationPercent)).toBe(false);
  });
});
