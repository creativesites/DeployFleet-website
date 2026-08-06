export interface FleetTcoInputs {
  purchasePriceZmw: number;
  annualDistanceKm: number;
  fuelCostPerKmZmw: number;
  annualMaintenanceTyresZmw: number;
  /** How much annual maintenance/tyre cost grows year over year as the vehicle ages, e.g. 0.08 for 8%. */
  maintenanceGrowthRatePerYear: number;
  annualInsuranceLicensingZmw: number;
  /** Annual loan/lease repayment burden. 0 for a cash purchase. */
  annualFinancingCostZmw: number;
  /** How much resale value is lost each year, as a fraction of the prior year's value, e.g. 0.15 for 15%. */
  annualDepreciationRate: number;
  horizonYears: number;
}

export interface FleetTcoYear {
  year: number;
  operatingCostThisYearZmw: number;
  cumulativeCostZmw: number;
  resaleValueZmw: number;
  netCostOfOwnershipZmw: number;
  costPerYearZmw: number;
  costPerKmZmw: number;
}

export interface FleetTcoResult {
  years: FleetTcoYear[];
  /** The year (1-indexed) with the lowest equivalent annual cost — the point replacing the vehicle stops paying off further delay. */
  optimalReplacementYear: number;
}

const MIN_RESALE_FRACTION_OF_PRICE = 0.05;

export function calculateFleetTco(inputs: FleetTcoInputs): FleetTcoResult {
  const horizonYears = Math.max(0, Math.floor(inputs.horizonYears));
  const purchasePriceZmw = Math.max(0, inputs.purchasePriceZmw);
  const floorResaleZmw = purchasePriceZmw * MIN_RESALE_FRACTION_OF_PRICE;

  const years: FleetTcoYear[] = [];
  let cumulativeCostZmw = purchasePriceZmw;

  for (let year = 1; year <= horizonYears; year++) {
    const maintenanceThisYearZmw =
      Math.max(0, inputs.annualMaintenanceTyresZmw) * Math.pow(1 + Math.max(0, inputs.maintenanceGrowthRatePerYear), year - 1);
    const operatingCostThisYearZmw =
      Math.max(0, inputs.fuelCostPerKmZmw) * Math.max(0, inputs.annualDistanceKm) +
      Math.max(0, inputs.annualInsuranceLicensingZmw) +
      Math.max(0, inputs.annualFinancingCostZmw) +
      maintenanceThisYearZmw;

    cumulativeCostZmw += operatingCostThisYearZmw;

    const rawResaleZmw = purchasePriceZmw * Math.pow(1 - Math.min(1, Math.max(0, inputs.annualDepreciationRate)), year);
    const resaleValueZmw = Math.max(floorResaleZmw, rawResaleZmw);

    const netCostOfOwnershipZmw = cumulativeCostZmw - resaleValueZmw;
    const costPerYearZmw = netCostOfOwnershipZmw / year;
    const costPerKmZmw = inputs.annualDistanceKm > 0 ? netCostOfOwnershipZmw / (year * inputs.annualDistanceKm) : 0;

    years.push({
      year,
      operatingCostThisYearZmw,
      cumulativeCostZmw,
      resaleValueZmw,
      netCostOfOwnershipZmw,
      costPerYearZmw,
      costPerKmZmw,
    });
  }

  let optimalReplacementYear = years.length > 0 ? years[0].year : 0;
  let lowestCostPerYearZmw = years.length > 0 ? years[0].costPerYearZmw : 0;
  for (const y of years) {
    if (y.costPerYearZmw < lowestCostPerYearZmw) {
      lowestCostPerYearZmw = y.costPerYearZmw;
      optimalReplacementYear = y.year;
    }
  }

  return { years, optimalReplacementYear };
}
