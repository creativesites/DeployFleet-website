export interface BreakEvenUtilisationInputs {
  numberOfTrucks: number;
  fixedCostsMonthlyZmwPerTruck: number;
  variableCostPerKmZmw: number;
  revenuePerKmZmw: number;
  /** The most km a truck could realistically run in a month, fully utilised. */
  maxKmPerTruckPerMonth: number;
  /** What a truck is actually averaging today. */
  actualKmPerTruckPerMonth: number;
  /** Months to linearly ramp from 0 km to actualKmPerTruckPerMonth (e.g. a new route/truck). 0 = no ramp, steady from month 1. */
  rampUpMonths: number;
  projectionMonths: number;
}

export type UtilisationStatus = "below-break-even" | "at-break-even" | "above-break-even";

export interface MonthlyCashFlow {
  month: number;
  kmPerTruck: number;
  fleetProfitZmw: number;
  cumulativeCashFlowZmw: number;
}

export interface BreakEvenUtilisationResult {
  contributionMarginPerKmZmw: number;
  /** Km/month a single truck needs to cover its fixed cost. Infinity if the rate never covers variable cost. */
  breakEvenKmPerTruckPerMonth: number;
  breakEvenUtilisationPercent: number;
  currentUtilisationPercent: number;
  surplusKmPerTruckPerMonth: number;
  status: UtilisationStatus;
  monthlyFleetProfitAtCurrentUtilisationZmw: number;
  monthlyProjection: MonthlyCashFlow[];
  /** First month cumulative cash flow crosses zero, or null if it doesn't within the projection window. */
  breakEvenMonth: number | null;
}

const STATUS_EPSILON_KM = 0.5;

export function calculateBreakEvenUtilisation(inputs: BreakEvenUtilisationInputs): BreakEvenUtilisationResult {
  const numberOfTrucks = Math.max(0, inputs.numberOfTrucks);
  const fixedCostsMonthlyZmwPerTruck = Math.max(0, inputs.fixedCostsMonthlyZmwPerTruck);
  const variableCostPerKmZmw = Math.max(0, inputs.variableCostPerKmZmw);
  const revenuePerKmZmw = Math.max(0, inputs.revenuePerKmZmw);
  const maxKmPerTruckPerMonth = Math.max(0, inputs.maxKmPerTruckPerMonth);
  const actualKmPerTruckPerMonth = Math.max(0, inputs.actualKmPerTruckPerMonth);
  const rampUpMonths = Math.max(0, Math.floor(inputs.rampUpMonths));
  const projectionMonths = Math.max(0, Math.floor(inputs.projectionMonths));

  const contributionMarginPerKmZmw = revenuePerKmZmw - variableCostPerKmZmw;

  const breakEvenKmPerTruckPerMonth =
    contributionMarginPerKmZmw > 0 ? fixedCostsMonthlyZmwPerTruck / contributionMarginPerKmZmw : Infinity;

  const breakEvenUtilisationPercent =
    maxKmPerTruckPerMonth > 0 && Number.isFinite(breakEvenKmPerTruckPerMonth)
      ? (breakEvenKmPerTruckPerMonth / maxKmPerTruckPerMonth) * 100
      : Infinity;

  const currentUtilisationPercent =
    maxKmPerTruckPerMonth > 0 ? (actualKmPerTruckPerMonth / maxKmPerTruckPerMonth) * 100 : 0;

  const surplusKmPerTruckPerMonth = Number.isFinite(breakEvenKmPerTruckPerMonth)
    ? actualKmPerTruckPerMonth - breakEvenKmPerTruckPerMonth
    : -Infinity;

  let status: UtilisationStatus = "at-break-even";
  if (surplusKmPerTruckPerMonth > STATUS_EPSILON_KM) status = "above-break-even";
  else if (surplusKmPerTruckPerMonth < -STATUS_EPSILON_KM) status = "below-break-even";

  const monthlyFleetProfitAtCurrentUtilisationZmw =
    numberOfTrucks * (actualKmPerTruckPerMonth * contributionMarginPerKmZmw - fixedCostsMonthlyZmwPerTruck);

  const monthlyProjection: MonthlyCashFlow[] = [];
  let cumulativeCashFlowZmw = 0;
  let breakEvenMonth: number | null = null;

  for (let month = 1; month <= projectionMonths; month++) {
    const rampFraction = rampUpMonths > 0 ? Math.min(1, month / rampUpMonths) : 1;
    const kmPerTruck = actualKmPerTruckPerMonth * rampFraction;
    const fleetProfitZmw = numberOfTrucks * (kmPerTruck * contributionMarginPerKmZmw - fixedCostsMonthlyZmwPerTruck);
    cumulativeCashFlowZmw += fleetProfitZmw;

    if (breakEvenMonth === null && cumulativeCashFlowZmw >= -1e-6) {
      breakEvenMonth = month;
    }

    monthlyProjection.push({ month, kmPerTruck, fleetProfitZmw, cumulativeCashFlowZmw });
  }

  return {
    contributionMarginPerKmZmw,
    breakEvenKmPerTruckPerMonth,
    breakEvenUtilisationPercent,
    currentUtilisationPercent,
    surplusKmPerTruckPerMonth,
    status,
    monthlyFleetProfitAtCurrentUtilisationZmw,
    monthlyProjection,
    breakEvenMonth,
  };
}
