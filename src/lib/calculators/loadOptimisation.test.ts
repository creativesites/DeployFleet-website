import { describe, expect, it } from "vitest";
import { calculateLoadOptimisation, type AxleGroupInput } from "./loadOptimisation";
import { AXLE_LOAD_LIMITS } from "../benchmarks";

const limits = AXLE_LOAD_LIMITS.value;

function groups(overrides: AxleGroupInput[]): AxleGroupInput[] {
  return overrides;
}

describe("calculateLoadOptimisation", () => {
  it("flags every group compliant when well within legal limits", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([
        { label: "Steering", groupType: "steering-single", actualLoadKg: 7500 },
        { label: "Drive", groupType: "drive-single", actualLoadKg: 9500 },
        { label: "Trailer", groupType: "tandem", actualLoadKg: 17000 },
      ]),
    });
    expect(result.groups.every((g) => g.status === "compliant")).toBe(true);
    expect(result.totalActualWeightKg).toBe(34_000);
    expect(result.totalAxleCount).toBe(4);
  });

  it("applies the tolerance allowance before flagging overload (boundary)", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([{ label: "Trailer", groupType: "tandem", actualLoadKg: 18_900 }]),
    });
    expect(result.groups[0].allowedLoadKg).toBe(18_900);
    expect(result.groups[0].status).toBe("compliant");
  });

  it("flags overload the moment actual load exceeds the tolerance-adjusted limit", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([{ label: "Trailer", groupType: "tandem", actualLoadKg: 18_901 }]),
    });
    expect(result.groups[0].status).toBe("overloaded");
    expect(result.groups[0].overloadKg).toBe(1);
  });

  it("has no applicable GVM cap below 6 total axles", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([
        { label: "Steering", groupType: "steering-single", actualLoadKg: 7500 },
        { label: "Drive", groupType: "drive-single", actualLoadKg: 9500 },
      ]),
    });
    expect(result.totalAxleCount).toBe(2);
    expect(result.gvmLimitKg).toBeNull();
    expect(result.gvmStatus).toBe("not-applicable");
  });

  it("flags GVM overload at 6 axles even when every individual group is compliant", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([
        { label: "Steering", groupType: "steering-single", actualLoadKg: 8000 },
        { label: "Drive", groupType: "drive-single", actualLoadKg: 10_000 },
        { label: "Trailer 1", groupType: "tandem", actualLoadKg: 18_000 },
        { label: "Trailer 2", groupType: "tandem", actualLoadKg: 18_000 },
      ]),
    });
    expect(result.totalAxleCount).toBe(6);
    expect(result.gvmLimitKg).toBe(48_000);
    expect(result.groups.every((g) => g.status === "compliant")).toBe(true);
    expect(result.gvmStatus).toBe("overloaded");
    expect(result.overGvmKg).toBe(6000);
  });

  it("uses the 7+ axle GVM cap once total axles reach 7", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([
        { label: "Steering", groupType: "steering-single", actualLoadKg: 7000 },
        { label: "Drive", groupType: "drive-single", actualLoadKg: 9000 },
        { label: "Trailer 1", groupType: "tridem", actualLoadKg: 20_000 },
        { label: "Trailer 2", groupType: "tridem", actualLoadKg: 20_000 },
      ]),
    });
    expect(result.totalAxleCount).toBe(8);
    expect(result.gvmLimitKg).toBe(56_000);
    expect(result.gvmStatus).toBe("compliant");
  });

  it("sets anyGroupOverloaded when at least one group is over, even if GVM is fine", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([{ label: "Steering", groupType: "steering-single", actualLoadKg: 9000 }]),
    });
    expect(result.anyGroupOverloaded).toBe(true);
    expect(result.gvmStatus).toBe("not-applicable");
  });

  it("treats a negative actual load as zero rather than reducing the total", () => {
    const result = calculateLoadOptimisation({
      limits,
      groups: groups([{ label: "Steering", groupType: "steering-single", actualLoadKg: -500 }]),
    });
    expect(result.groups[0].actualLoadKg).toBe(0);
    expect(result.groups[0].status).toBe("compliant");
  });
});
