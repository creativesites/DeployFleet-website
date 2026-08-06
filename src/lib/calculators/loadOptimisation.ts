import type { AxleLoadLimits } from "../benchmarks";

export type AxleGroupType = "steering-single" | "drive-single" | "tandem" | "tridem";

export interface AxleGroupInput {
  label: string;
  groupType: AxleGroupType;
  actualLoadKg: number;
}

export interface LoadOptimisationInputs {
  groups: AxleGroupInput[];
  limits: AxleLoadLimits;
}

const AXLES_PER_GROUP_TYPE: Record<AxleGroupType, number> = {
  "steering-single": 1,
  "drive-single": 1,
  tandem: 2,
  tridem: 3,
};

function legalLimitFor(groupType: AxleGroupType, limits: AxleLoadLimits): number {
  switch (groupType) {
    case "steering-single":
      return limits.steeringSingleKg;
    case "drive-single":
      return limits.driveSingleKg;
    case "tandem":
      return limits.tandemKg;
    case "tridem":
      return limits.tridemKg;
  }
}

export type AxleGroupStatus = "compliant" | "overloaded";

export interface AxleGroupResult extends AxleGroupInput {
  axleCount: number;
  legalLimitKg: number;
  allowedLoadKg: number;
  overloadKg: number;
  status: AxleGroupStatus;
}

export type GvmStatus = "compliant" | "overloaded" | "not-applicable";

export interface LoadOptimisationResult {
  groups: AxleGroupResult[];
  totalActualWeightKg: number;
  totalAxleCount: number;
  gvmLimitKg: number | null;
  gvmStatus: GvmStatus;
  overGvmKg: number;
  anyGroupOverloaded: boolean;
}

export function calculateLoadOptimisation(inputs: LoadOptimisationInputs): LoadOptimisationResult {
  const groups: AxleGroupResult[] = inputs.groups.map((group) => {
    const axleCount = AXLES_PER_GROUP_TYPE[group.groupType];
    const legalLimitKg = legalLimitFor(group.groupType, inputs.limits);
    const allowedLoadKg = legalLimitKg * (1 + inputs.limits.toleranceFraction);
    const actualLoadKg = Math.max(0, group.actualLoadKg);
    const overloadKg = Math.max(0, actualLoadKg - allowedLoadKg);
    const status: AxleGroupStatus = overloadKg > 0 ? "overloaded" : "compliant";

    return { ...group, actualLoadKg, axleCount, legalLimitKg, allowedLoadKg, overloadKg, status };
  });

  const totalActualWeightKg = groups.reduce((sum, g) => sum + g.actualLoadKg, 0);
  const totalAxleCount = groups.reduce((sum, g) => sum + g.axleCount, 0);

  let gvmLimitKg: number | null = null;
  if (totalAxleCount >= 7) gvmLimitKg = inputs.limits.gvmAt7PlusAxlesKg;
  else if (totalAxleCount === 6) gvmLimitKg = inputs.limits.gvmAt6AxlesKg;

  const overGvmKg = gvmLimitKg !== null ? Math.max(0, totalActualWeightKg - gvmLimitKg) : 0;
  const gvmStatus: GvmStatus = gvmLimitKg === null ? "not-applicable" : overGvmKg > 0 ? "overloaded" : "compliant";

  const anyGroupOverloaded = groups.some((g) => g.status === "overloaded");

  return { groups, totalActualWeightKg, totalAxleCount, gvmLimitKg, gvmStatus, overGvmKg, anyGroupOverloaded };
}
