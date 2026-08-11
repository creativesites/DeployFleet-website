import { describe, expect, it } from "vitest";
import { clampScore, engagementBand, intentCategory } from "./scoring";

describe("clampScore", () => {
  it("clamps below zero up to zero", () => {
    expect(clampScore(-5)).toBe(0);
  });

  it("clamps above 100 down to 100", () => {
    expect(clampScore(150)).toBe(100);
  });

  it("rounds a fractional in-range value", () => {
    expect(clampScore(42.6)).toBe(43);
  });

  it("passes an in-range integer through unchanged", () => {
    expect(clampScore(50)).toBe(50);
  });
});

describe("engagementBand", () => {
  it("bands the boundary values per spec §8", () => {
    expect(engagementBand(0)).toBe("low");
    expect(engagementBand(19)).toBe("low");
    expect(engagementBand(20)).toBe("moderate");
    expect(engagementBand(39)).toBe("moderate");
    expect(engagementBand(40)).toBe("engaged");
    expect(engagementBand(69)).toBe("engaged");
    expect(engagementBand(70)).toBe("highly-engaged");
    expect(engagementBand(89)).toBe("highly-engaged");
    expect(engagementBand(90)).toBe("high-intent");
    expect(engagementBand(100)).toBe("high-intent");
  });
});

describe("intentCategory", () => {
  it("categorizes the boundary values per spec §21", () => {
    expect(intentCategory(0)).toBe("cold");
    expect(intentCategory(14)).toBe("cold");
    expect(intentCategory(15)).toBe("warm");
    expect(intentCategory(34)).toBe("warm");
    expect(intentCategory(35)).toBe("interested");
    expect(intentCategory(59)).toBe("interested");
    expect(intentCategory(60)).toBe("high-intent");
    expect(intentCategory(79)).toBe("high-intent");
    expect(intentCategory(80)).toBe("sales-ready");
    expect(intentCategory(100)).toBe("sales-ready");
  });
});
