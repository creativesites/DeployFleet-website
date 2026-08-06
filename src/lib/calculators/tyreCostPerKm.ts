export interface TyreOptionInputs {
  purchasePriceZmw: number;
  /** Km of tread life before the tyre needs its first retread (or replacement, if never retreaded). */
  expectedLifeKm: number;
  numberOfRetreads: number;
  retreadCostZmw: number;
  /** Km of tread life delivered by each retread — typically shorter than the original casing life. */
  retreadLifeKm: number;
}

export interface TyreCostPerKmInputs {
  budget: TyreOptionInputs;
  premium: TyreOptionInputs;
  /** Tyre positions on the vehicle this comparison is for (e.g. 6 for a rigid, 10-18 for an articulated combination). */
  tyrePositionsOnVehicle: number;
  annualDistanceKm: number;
}

export interface TyreOptionResult {
  totalLifecycleKm: number;
  totalLifecycleCostZmw: number;
  costPerKmZmw: number;
  annualCostPerVehicleZmw: number;
}

export type CheaperOption = "budget" | "premium" | "equal";

export interface TyreCostPerKmResult {
  budget: TyreOptionResult;
  premium: TyreOptionResult;
  cheaperOption: CheaperOption;
  savingsPerKmZmw: number;
  annualSavingsPerVehicleZmw: number;
}

function evaluateOption(option: TyreOptionInputs, tyrePositions: number, annualDistanceKm: number): TyreOptionResult {
  const retreads = Math.max(0, option.numberOfRetreads);
  const totalLifecycleKm = Math.max(0, option.expectedLifeKm) + retreads * Math.max(0, option.retreadLifeKm);
  const totalLifecycleCostZmw = Math.max(0, option.purchasePriceZmw) + retreads * Math.max(0, option.retreadCostZmw);
  const costPerKmZmw = totalLifecycleKm > 0 ? totalLifecycleCostZmw / totalLifecycleKm : 0;
  const annualCostPerVehicleZmw = costPerKmZmw * Math.max(0, annualDistanceKm) * Math.max(0, tyrePositions);

  return { totalLifecycleKm, totalLifecycleCostZmw, costPerKmZmw, annualCostPerVehicleZmw };
}

export function calculateTyreCostPerKm(inputs: TyreCostPerKmInputs): TyreCostPerKmResult {
  const budget = evaluateOption(inputs.budget, inputs.tyrePositionsOnVehicle, inputs.annualDistanceKm);
  const premium = evaluateOption(inputs.premium, inputs.tyrePositionsOnVehicle, inputs.annualDistanceKm);

  const savingsPerKmZmw = budget.costPerKmZmw - premium.costPerKmZmw;
  let cheaperOption: CheaperOption = "equal";
  if (savingsPerKmZmw > 0) cheaperOption = "premium";
  else if (savingsPerKmZmw < 0) cheaperOption = "budget";

  const annualSavingsPerVehicleZmw = budget.annualCostPerVehicleZmw - premium.annualCostPerVehicleZmw;

  return { budget, premium, cheaperOption, savingsPerKmZmw, annualSavingsPerVehicleZmw };
}
