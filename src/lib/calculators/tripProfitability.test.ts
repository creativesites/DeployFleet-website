import { describe, expect, it } from "vitest";
import { calculateTripProfitability, type TripProfitabilityInputs } from "./tripProfitability";

const baseInputs: TripProfitabilityInputs = {
  distanceKm: 400,
  revenueMode: "perKm",
  ratePerKmZmw: 30,
  lumpSumZmw: 0,
  fuelPriceZmwPerLitre: 26.86,
  fuelConsumptionLPer100Km: 38,
  driverAllowanceZmw: 800,
  tollsZmw: 300,
  borderFeesZmw: 0,
  tyresPerKmZmw: 0.9,
  maintenanceReservePerKmZmw: 0.6,
  otherCostsZmw: 0,
};

describe("calculateTripProfitability", () => {
  it("computes revenue from rate x distance in perKm mode", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.totalRevenueZmw).toBe(30 * 400);
  });

  it("uses the lump sum directly in lumpSum mode, ignoring the per-km rate", () => {
    const result = calculateTripProfitability({
      ...baseInputs,
      revenueMode: "lumpSum",
      lumpSumZmw: 15000,
      ratePerKmZmw: 999,
    });
    expect(result.totalRevenueZmw).toBe(15000);
  });

  it("computes fuel cost from consumption, distance, and price", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.fuelCostZmw).toBeCloseTo((38 / 100) * 400 * 26.86, 5);
  });

  it("gross profit equals revenue minus every cost component", () => {
    const result = calculateTripProfitability(baseInputs);
    const manualCost =
      result.fuelCostZmw +
      result.distanceCostZmw +
      baseInputs.driverAllowanceZmw +
      baseInputs.tollsZmw +
      baseInputs.borderFeesZmw +
      baseInputs.otherCostsZmw;
    expect(result.totalCostZmw).toBeCloseTo(manualCost, 10);
    expect(result.grossProfitZmw).toBeCloseTo(result.totalRevenueZmw - manualCost, 10);
  });

  it("break-even rate per km covers exactly the total cost at that distance", () => {
    const result = calculateTripProfitability(baseInputs);
    expect(result.breakEvenRatePerKmZmw * baseInputs.distanceKm).toBeCloseTo(result.totalCostZmw, 6);
  });

  it("flags a loss when costs exceed revenue", () => {
    const result = calculateTripProfitability({ ...baseInputs, ratePerKmZmw: 5 });
    expect(result.grossProfitZmw).toBeLessThan(0);
    expect(result.status).toBe("loss");
  });

  it("flags thin-margin between 0% and the healthy threshold", () => {
    // Fixed cost here is 5,782.72 ZMW; a rate of 15.5/km over 400km puts
    // margin at ~6.7%, inside (0, 15).
    const result = calculateTripProfitability({ ...baseInputs, ratePerKmZmw: 15.5 });
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
    expect(result.profitPerKmZmw).toBe(0);
    expect(result.breakEvenRatePerKmZmw).toBe(0);
    expect(Number.isFinite(result.totalCostZmw)).toBe(true);
  });

  it("is deterministic", () => {
    expect(calculateTripProfitability(baseInputs)).toEqual(calculateTripProfitability(baseInputs));
  });
});
