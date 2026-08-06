import { describe, expect, it } from "vitest";
import { calculateTripProfitability, type TripProfitabilityInputs } from "./tripProfitability";

const baseInputs: TripProfitabilityInputs = {
  distanceKm: 400,
  revenueMode: "perKm",
  ratePerKm: 30,
  lumpSum: 0,
  fuelPricePerLitre: 26.86,
  fuelConsumptionLPer100Km: 38,
  driverAllowance: 800,
  tolls: 300,
  borderFees: 0,
  tyresPerKm: 0.9,
  maintenanceReservePerKm: 0.6,
  otherCosts: 0,
};

describe("calculateTripProfitability", () => {
  it("computes revenue from rate x distance in perKm mode", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.totalRevenue).toBe(30 * 400);
  });

  it("uses the lump sum directly in lumpSum mode, ignoring the per-km rate", () => {
    const result = calculateTripProfitability({
      ...baseInputs,
      revenueMode: "lumpSum",
      lumpSum: 15000,
      ratePerKm: 999,
    });
    expect(result.totalRevenue).toBe(15000);
  });

  it("computes fuel cost from consumption, distance, and price", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.fuelCost).toBeCloseTo((38 / 100) * 400 * 26.86, 5);
  });

  it("gross profit equals revenue minus every cost component", () => {
    const result = calculateTripProfitability(baseInputs);
    const manualCost =
      result.fuelCost + result.distanceCost + baseInputs.driverAllowance + baseInputs.tolls + baseInputs.borderFees + baseInputs.otherCosts;
    expect(result.totalCost).toBeCloseTo(manualCost, 10);
    expect(result.grossProfit).toBeCloseTo(result.totalRevenue - manualCost, 10);
  });

  it("break-even rate per km covers exactly the total cost at that distance", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.breakEvenRatePerKm * baseInputs.distanceKm).toBeCloseTo(result.totalCost, 6);
  });

  it("flags a loss when costs exceed revenue", () => {
    const result = calculateTripProfitability({ ...baseInputs, ratePerKm: 5 });
    expect(result.grossProfit).toBeLessThan(0);
    expect(result.status).toBe("loss");
  });

  it("flags thin-margin between 0% and the healthy threshold", () => {
    // Fixed cost here is 5,782.72; a rate of 15.5/km over 400km puts
    // margin at ~6.7%, inside (0, 15).
    const result = calculateTripProfitability({ ...baseInputs, ratePerKm: 15.5 });
    expect(result.profitMarginPercent).toBeGreaterThan(0);
    expect(result.profitMarginPercent).toBeLessThan(15);
    expect(result.status).toBe("thin-margin");
  });

  it("flags healthy at or above the 15% margin threshold", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.profitMarginPercent).toBeGreaterThanOrEqual(15);
    expect(result.status).toBe("healthy");
  });

  it("never divides by zero when distance is 0", () => {
    const result = calculateTripProfitability({ ...baseInputs, distanceKm: 0 });
    expect(result.profitPerKm).toBe(0);
    expect(result.breakEvenRatePerKm).toBe(0);
    expect(Number.isFinite(result.totalCost)).toBe(true);
  });

  it("is deterministic", () => {
    expect(calculateTripProfitability(baseInputs)).toEqual(calculateTripProfitability(baseInputs));
  });
});
