import { describe, expect, it } from "vitest";
import { calculateComplianceRisk, type ComplianceRiskInputs } from "./complianceRisk";

const TODAY = "2026-08-06";

function baseInputs(overrides: Partial<ComplianceRiskInputs> = {}): ComplianceRiskInputs {
  return {
    todayIso: TODAY,
    items: [
      { name: "Insurance", expiryDate: "2026-09-05", renewalCostZmw: 4500, estimatedPenaltyIfExpiredZmw: 15000 },
      { name: "Fitness Certificate", expiryDate: "2026-09-06", renewalCostZmw: 800, estimatedPenaltyIfExpiredZmw: 5000 },
      { name: "Road Tax", expiryDate: "2026-08-05", renewalCostZmw: 1200, estimatedPenaltyIfExpiredZmw: 8000 },
    ],
    ...overrides,
  };
}

describe("calculateComplianceRisk", () => {
  it("flags a document expiring in exactly 30 days as expiring-soon (boundary)", () => {
    const result = calculateComplianceRisk(baseInputs());
    const insurance = result.items.find((i) => i.name === "Insurance")!;
    expect(insurance.daysUntilExpiry).toBe(30);
    expect(insurance.status).toBe("expiring-soon");
  });

  it("flags a document expiring in 31 days as valid", () => {
    const result = calculateComplianceRisk(baseInputs());
    const fitness = result.items.find((i) => i.name === "Fitness Certificate")!;
    expect(fitness.daysUntilExpiry).toBe(31);
    expect(fitness.status).toBe("valid");
  });

  it("flags a document that expired yesterday as expired, with negative days", () => {
    const result = calculateComplianceRisk(baseInputs());
    const roadTax = result.items.find((i) => i.name === "Road Tax")!;
    expect(roadTax.daysUntilExpiry).toBe(-1);
    expect(roadTax.status).toBe("expired");
  });

  it("treats a document expiring today (0 days) as expiring-soon, not expired", () => {
    const result = calculateComplianceRisk(
      baseInputs({ items: [{ name: "Permit", expiryDate: TODAY, renewalCostZmw: 500, estimatedPenaltyIfExpiredZmw: 2000 }] })
    );
    expect(result.items[0].daysUntilExpiry).toBe(0);
    expect(result.items[0].status).toBe("expiring-soon");
  });

  it("sums renewal cost across all items regardless of status", () => {
    const result = calculateComplianceRisk(baseInputs());
    expect(result.totalRenewalCostZmw).toBeCloseTo(4500 + 800 + 1200);
  });

  it("sums penalty exposure only for currently-expired items", () => {
    const result = calculateComplianceRisk(baseInputs());
    expect(result.totalPenaltyExposureZmw).toBeCloseTo(8000);
  });

  it("counts items per status correctly", () => {
    const result = calculateComplianceRisk(baseInputs());
    expect(result.expiredCount).toBe(1);
    expect(result.expiringSoonCount).toBe(1);
    expect(result.validCount).toBe(1);
  });

  it("picks the soonest-expiring non-expired item, ignoring already-expired ones", () => {
    const result = calculateComplianceRisk(baseInputs());
    expect(result.soonestExpiring?.name).toBe("Insurance");
  });

  it("returns null soonestExpiring when every item is already expired", () => {
    const result = calculateComplianceRisk(
      baseInputs({
        items: [{ name: "Old Permit", expiryDate: "2026-01-01", renewalCostZmw: 100, estimatedPenaltyIfExpiredZmw: 1000 }],
      })
    );
    expect(result.soonestExpiring).toBeNull();
  });

  it("flags an unparseable expiry date as invalid-date rather than crashing", () => {
    const result = calculateComplianceRisk(
      baseInputs({ items: [{ name: "Broken", expiryDate: "", renewalCostZmw: 0, estimatedPenaltyIfExpiredZmw: 0 }] })
    );
    expect(result.items[0].status).toBe("invalid-date");
  });
});
