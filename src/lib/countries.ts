import type { SourcedValue } from "./benchmarks";

/**
 * Multi-country support for the Intelligence Hub. Zambia is the default
 * and the only "full" country today. Every other country is honestly
 * tiered by how much of its data is actually sourced — see `coverage`.
 * Never backfill a missing figure with another country's number; a
 * missing figure means the UI shows "not yet available," not a silently
 * wrong answer in the wrong currency.
 */

export type CountryCode = "ZM" | "ZW" | "ZA" | "BW" | "NA" | "MZ";

/**
 * "full" - currency, income tax, social security, and diesel price are
 *   all sourced; every calculator works correctly for this country.
 * "currency-only" - currency/locale are set, but tax/toll/diesel data
 *   isn't sourced yet. Country-sensitive calculators (Cost Per Km, Trip
 *   Profitability, Driver Pay) show an honest "not available" state
 *   instead of guessing.
 * "not-yet-available" - reserved for a future country not in this list
 *   yet at all; unused today but kept so the type covers it.
 */
export type CoverageLevel = "full" | "currency-only" | "not-yet-available";

export interface IncomeTaxBand {
  from: number;
  /** null = top, unbounded band. */
  to: number | null;
  rate: number;
}

export interface IncomeTaxConfig {
  period: "monthly" | "annual";
  bands: IncomeTaxBand[];
  /** A levy computed as a percentage of the computed tax itself (e.g. Zimbabwe's AIDS levy), not of gross pay. */
  levyOnTaxPercent: number;
  levyOnTaxLabel: string;
}

export interface SocialSecurityConfig {
  /** What this is actually called locally — "NAPSA", "NSSA", etc. Shown in the UI. */
  label: string;
  employeeRate: number;
  employerRate: number;
  /** Cap on the employee's monthly deduction itself (not on earnings) — pre-computed from the earnings ceiling where the source expresses it that way. */
  employeeCapPerMonth: number;
}

/** A second, separate statutory deduction some countries have and others don't — e.g. Zambia's NHIMA. Null where no equivalent exists. */
export interface SecondaryLevyConfig {
  label: string;
  employeeRate: number;
  /** null = no cap (e.g. NHIMA). */
  employeeCapPerMonth: number | null;
}

export interface TollConfig {
  fourPlusAxleHeavy: number;
  twoToFourAxleMediumHeavy: number;
  abnormalLoad: number | null;
}

export interface CountryConfig {
  code: CountryCode;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  coverage: CoverageLevel;
  dieselPricePerLitre: SourcedValue<number> | null;
  incomeTax: SourcedValue<IncomeTaxConfig> | null;
  socialSecurity: SourcedValue<SocialSecurityConfig> | null;
  secondaryLevy: SourcedValue<SecondaryLevyConfig> | null;
  tolls: SourcedValue<TollConfig> | null;
}

export const DEFAULT_COUNTRY_CODE: CountryCode = "ZM";

const zambia: CountryConfig = {
  code: "ZM",
  name: "Zambia",
  currencyCode: "ZMW",
  currencySymbol: "K",
  locale: "en-ZM",
  coverage: "full",
  dieselPricePerLitre: {
    value: 26.86,
    source: "Energy Regulation Board (ERB) Zambia",
    asOf: "2026-08-01",
    confidence: "medium",
    note: "Reviewed monthly and has moved by more than K4/litre month-to-month in 2026 — confirm the current price at erb.org.zm before relying on this for a real decision.",
  },
  incomeTax: {
    value: {
      period: "monthly",
      bands: [
        { from: 0, to: 5100, rate: 0 },
        { from: 5100, to: 7100, rate: 0.25 },
        { from: 7100, to: 9900, rate: 0.3 },
        { from: 9900, to: null, rate: 0.375 },
      ],
      levyOnTaxPercent: 0,
      levyOnTaxLabel: "",
    },
    source: "ZRA PAYE bands, cross-checked against two independent 2026 payroll guides",
    asOf: "2026-04-16",
    confidence: "medium",
    note: "zra.org.zm's own PAYE calculator and published PDF were unreachable (503) while sourcing this — cross-verified instead against two independent Zambian payroll-guide sites that agree on these exact bands. Bands apply progressively. NAPSA (employee share) is deducted before PAYE is calculated; NHIMA is not.",
  },
  socialSecurity: {
    value: { label: "NAPSA", employeeRate: 0.05, employerRate: 0.05, employeeCapPerMonth: 1861.8 },
    source: "National Pension Scheme Authority (NAPSA) 2026 ceiling update",
    asOf: "2026-01-01",
    confidence: "high",
    note: "5% employee + 5% employer, capped at the monthly earnings ceiling — the deduction cannot exceed the cap regardless of actual salary.",
  },
  secondaryLevy: {
    value: { label: "NHIMA", employeeRate: 0.01, employeeCapPerMonth: null },
    source: "NHIMA Act contribution rate, cross-checked against two independent 2026 payroll guides",
    asOf: "2026-04-16",
    confidence: "medium",
    note: "1% of gross salary, no ceiling — unlike NAPSA.",
  },
  tolls: {
    value: { fourPlusAxleHeavy: 300, twoToFourAxleMediumHeavy: 200, abnormalLoad: 1000 },
    source: "National Road Fund Agency (NRFA) 2026 toll adjustment",
    asOf: "2026-01-01",
    confidence: "high",
    note: "Per single toll-gate passage. A single trip often crosses multiple gates — multiply by the number of gates on the route, not by distance.",
  },
};

const zimbabwe: CountryConfig = {
  code: "ZW",
  name: "Zimbabwe",
  currencyCode: "USD",
  currencySymbol: "US$",
  locale: "en-ZW",
  coverage: "full",
  dieselPricePerLitre: {
    value: 1.87,
    source: "Zimbabwe Energy Regulatory Authority (ZERA) fortnightly review",
    asOf: "2026-08-07",
    confidence: "medium",
    note: "ZERA revises fuel prices roughly fortnightly and diesel has swung between US$1.77 and US$2.09/litre through 2026 — confirm the current price at zera.co.zw before relying on this for a real decision. Zimbabwe is priced in USD by explicit choice here, not ZWG — in practice most fleet-scale transactions in Zimbabwe are USD-denominated regardless of the official multi-currency regime.",
  },
  incomeTax: {
    value: {
      period: "annual",
      bands: [
        { from: 0, to: 1200, rate: 0 },
        { from: 1200, to: 3600, rate: 0.2 },
        { from: 3600, to: 36000, rate: 0.25 },
        { from: 36000, to: null, rate: 0.4 },
      ],
      levyOnTaxPercent: 3,
      levyOnTaxLabel: "AIDS levy",
    },
    source: "ZIMRA USD PAYE tax table, cross-checked against a second independent 2026 payroll guide",
    asOf: "2026-01-01",
    confidence: "medium",
    note: "These are the direct USD-denominated bands ZIMRA publishes, not a ZWG table converted at a spot rate — a second source converting from ZWG landed on slightly different USD-equivalent thresholds, consistent with using a different exchange-rate snapshot, not a contradiction in the underlying ZWG table. The 3% AIDS levy applies to the computed tax amount, not to gross pay. Confirm against ZIMRA directly before relying on this for a real payslip.",
  },
  socialSecurity: {
    value: { label: "NSSA", employeeRate: 0.035, employerRate: 0.035, employeeCapPerMonth: 24.5 },
    source: "National Social Security Authority (NSSA) contribution rate, cross-checked against a second independent 2026 payroll guide",
    asOf: "2026-01-01",
    confidence: "medium",
    note: "3.5% employee + 3.5% employer, capped at USD 700/month of insurable earnings — expressed here as the resulting deduction cap (US$24.50/month) to match how the Zambia NAPSA figure is stored. One source reported a different split (4.5%/4.5%); the 3.5%/3.5% figure is used here as the majority-agreeing figure across sources checked.",
  },
  secondaryLevy: null,
  tolls: null,
};

function currencyOnlyCountry(
  code: CountryCode,
  name: string,
  currencyCode: string,
  currencySymbol: string,
  locale: string
): CountryConfig {
  return {
    code,
    name,
    currencyCode,
    currencySymbol,
    locale,
    coverage: "currency-only",
    dieselPricePerLitre: null,
    incomeTax: null,
    socialSecurity: null,
    secondaryLevy: null,
    tolls: null,
  };
}

const southAfrica = currencyOnlyCountry("ZA", "South Africa", "ZAR", "R", "en-ZA");
const botswana = currencyOnlyCountry("BW", "Botswana", "BWP", "P", "en-BW");
const namibia = currencyOnlyCountry("NA", "Namibia", "NAD", "N$", "en-NA");
const mozambique = currencyOnlyCountry("MZ", "Mozambique", "MZN", "MT", "pt-MZ");

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  ZM: zambia,
  ZW: zimbabwe,
  ZA: southAfrica,
  BW: botswana,
  NA: namibia,
  MZ: mozambique,
};

export const COUNTRY_LIST: CountryConfig[] = [zambia, zimbabwe, southAfrica, botswana, namibia, mozambique];

export function getCountry(code: CountryCode): CountryConfig {
  return COUNTRIES[code] ?? COUNTRIES[DEFAULT_COUNTRY_CODE];
}

export function formatMoney(value: number, country: CountryConfig): string {
  return `${country.currencySymbol}${value.toLocaleString(country.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
