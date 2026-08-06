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
  /** Cap on the employee's monthly deduction itself (not on earnings) — pre-computed from the earnings ceiling where the source expresses it that way. null = no cap found/applicable (e.g. Mozambique's INSS, which sources confirm applies uncapped). */
  employeeCapPerMonth: number | null;
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

const southAfrica: CountryConfig = {
  code: "ZA",
  name: "South Africa",
  currencyCode: "ZAR",
  currencySymbol: "R",
  locale: "en-ZA",
  coverage: "full",
  dieselPricePerLitre: {
    value: 26.16,
    source: "Department of Mineral Resources and Energy (DMRE), inland 0.05% sulphur benchmark, via CAR Magazine and The Citizen",
    asOf: "2026-08-05",
    confidence: "medium",
    note: "Inland price — coastal is lower (R25.29/L as of the same date). DMRE adjusts monthly and diesel rose R1.38/L in August 2026 alone — confirm the current price before relying on this for a real decision.",
  },
  incomeTax: {
    value: {
      period: "annual",
      bands: [
        { from: 0, to: 99000, rate: 0 },
        { from: 99000, to: 245100, rate: 0.18 },
        { from: 245100, to: 383100, rate: 0.26 },
        { from: 383100, to: 530200, rate: 0.31 },
        { from: 530200, to: 695800, rate: 0.36 },
        { from: 695800, to: 887000, rate: 0.39 },
        { from: 887000, to: 1878600, rate: 0.41 },
        { from: 1878600, to: null, rate: 0.45 },
      ],
      levyOnTaxPercent: 0,
      levyOnTaxLabel: "",
    },
    source: "SARS \"Rates of Tax for Individuals\", 2027 tax year (1 Mar 2026 – 28 Feb 2027)",
    asOf: "2026-08-06",
    confidence: "high",
    note: "SARS doesn't publish a 0% band — it taxes from R1 at 18% and subtracts a flat annual primary rebate (R17,820) from the result. The 0%-to-R99,000 band above is a mathematically exact conversion of that rebate into an equivalent band (R17,820 ÷ 18% = R99,000), not an approximation — verified to produce identical tax at every income level for a taxpayer under 65. It does not model the additional secondary (65+) or tertiary (75+) age-based rebates, so it will show a slightly higher tax than reality for an older driver.",
  },
  socialSecurity: {
    value: { label: "UIF", employeeRate: 0.01, employerRate: 0.01, employeeCapPerMonth: 177.12 },
    source: "SARS \"Unemployment Insurance Fund\"; earnings ceiling per Government Gazette No. 44641 (28 May 2021)",
    asOf: "2026-08-06",
    confidence: "high",
    note: "1% employee + 1% employer, capped at a R17,712/month earnings ceiling unchanged since June 2021 — so the R177.12 monthly cap is a long-standing fixed figure, not a recent update.",
  },
  secondaryLevy: null,
  tolls: {
    value: { fourPlusAxleHeavy: 222, twoToFourAxleMediumHeavy: 154, abnormalLoad: null },
    source: "N3TC toll tariffs, De Hoek Plaza (N3, Johannesburg–Durban corridor), effective 1 March 2026",
    asOf: "2026-03-01",
    confidence: "medium",
    note: "Per single toll-gate passage — SANRAL tariffs are set per plaza, not nationally, and vary considerably (e.g. Wilge Plaza on the same N3 corridor charges R294 for the same heavy-vehicle class). No National Health Insurance-style second employee payroll deduction exists in South Africa as of this date — the NHI Act is signed into law but not yet in operation. No abnormal-load toll figure was found for this plaza.",
  },
};

const botswana: CountryConfig = {
  code: "BW",
  name: "Botswana",
  currencyCode: "BWP",
  currencySymbol: "P",
  locale: "en-BW",
  coverage: "full",
  dieselPricePerLitre: {
    value: 20.93,
    source: "GlobalPetrolPrices.com and oilpricez.com, both citing Botswana Energy Regulatory Authority (BERA) pricing",
    asOf: "2026-08-03",
    confidence: "medium",
    note: "Two independent fuel-price trackers agree exactly on this figure, but it wasn't independently verified against BERA's own primary-source press release (not machine-readable when checked) — confirm at bera.co.bw before relying on this for a real decision.",
  },
  incomeTax: {
    value: {
      period: "annual",
      bands: [
        { from: 0, to: 48000, rate: 0 },
        { from: 48000, to: 84000, rate: 0.05 },
        { from: 84000, to: 120000, rate: 0.125 },
        { from: 120000, to: 156000, rate: 0.1875 },
        { from: 156000, to: 400000, rate: 0.25 },
        { from: 400000, to: null, rate: 0.275 },
      ],
      levyOnTaxPercent: 0,
      levyOnTaxLabel: "",
    },
    source: "KPMG Botswana tax-reform alert and countrytaxcalc.com Botswana PAYE Guide, both reporting the Income Tax Act amendment effective 1 July 2026",
    asOf: "2026-07-01",
    confidence: "medium",
    note: "Botswana added a new 27.5% top band above P400,000/year on 1 July 2026, replacing the previous flat 25% cap above P156,000 — older sources still showing a 5-band table without this top rate reflect the pre-reform structure. Not independently verified against BURS's own tax-laws page directly (not reachable when checked).",
  },
  socialSecurity: {
    value: { label: "No mandatory social security", employeeRate: 0, employerRate: 0, employeeCapPerMonth: 0 },
    source: "PwC Worldwide Tax Summaries — Botswana, corroborated by the RemotePeople, Playroll, and Workforce Africa payroll guides",
    asOf: "2026-08-06",
    confidence: "high",
    note: "Botswana has no statutory social-security or pension scheme for private-sector employees — unlike Zambia's NAPSA or Zimbabwe's NSSA, this is a genuine zero, confirmed across multiple independent sources, not a gap. Private employers commonly run a voluntary occupational retirement fund (regulated by NBFIRA under the Retirement Funds Act) at roughly employer 10-15%/employee ~5% of salary, but these are contractual norms rather than a statutory rate, so none is modeled here.",
  },
  secondaryLevy: null,
  tolls: {
    value: { fourPlusAxleHeavy: 0, twoToFourAxleMediumHeavy: 0, abnormalLoad: null },
    source: "The Botswana Gazette (\"Road Tolling in Botswana: Exploring the Options for a Sustainable Future for Roads\")",
    asOf: "2026-08-06",
    confidence: "high",
    note: "Botswana has no domestic toll-gate network — tolling has been publicly discussed as a future option but isn't implemented as of 2026, so this is a genuine zero. Excludes the separate Kazungula Bridge cross-border toll to Zambia (~US$100/truck one-way as last publicly reported in 2021, not reconfirmed for 2026) and foreign-vehicle entry levies, both cross-border costs rather than a domestic per-trip toll.",
  },
};

const namibia: CountryConfig = {
  code: "NA",
  name: "Namibia",
  currencyCode: "NAD",
  currencySymbol: "N$",
  locale: "en-NA",
  coverage: "full",
  dieselPricePerLitre: {
    value: 26.26,
    source: "Namibia Ministry of Industries, Mines and Energy (MME), Fuel Price Media Release, August 2026",
    asOf: "2026-08-05",
    confidence: "medium",
    note: "This is the Walvis Bay (coastal) reference price, 50ppm diesel — MME's own release confirms inland zones including Windhoek are adjusted upward from this base, but no current inland figure was found. Prices moved non-monotonically this year (a reduction, then a N$2.00/L jump in August from reinstated fuel levies) — confirm the current price before relying on this for a real decision.",
  },
  incomeTax: {
    value: {
      period: "annual",
      bands: [
        { from: 0, to: 100000, rate: 0 },
        { from: 100000, to: 150000, rate: 0.18 },
        { from: 150000, to: 350000, rate: 0.25 },
        { from: 350000, to: 550000, rate: 0.28 },
        { from: 550000, to: 850000, rate: 0.3 },
        { from: 850000, to: 1550000, rate: 0.32 },
        { from: 1550000, to: null, rate: 0.37 },
      ],
      levyOnTaxPercent: 0,
      levyOnTaxLabel: "",
    },
    source: "PwC Namibia Tax Reference and Rate Card 2026, 2026/27 year of assessment (Namibia's tax year runs March-February)",
    asOf: "2026-05-01",
    confidence: "high",
    note: "An Income Tax Amendment Bill adjusting brackets/thresholds was under legal review as of mid-2026 but not yet enacted — these are the currently-effective 2026/27 bands.",
  },
  socialSecurity: {
    value: { label: "SSC", employeeRate: 0.009, employerRate: 0.009, employeeCapPerMonth: 99 },
    source: "PwC Namibia Tax Reference and Rate Card 2026; wage-ceiling update corroborated by CRS.co.za and Sage VIP Community Hub",
    asOf: "2026-05-01",
    confidence: "high",
    note: "0.9% employee + 0.9% employer of earnings, capped at N$99/month per side since the wage ceiling used for the calculation rose to N$11,000/month on 1 March 2025 — older sources citing an ~N$81 cap reflect the pre-2025 ceiling and are outdated. A small N$4.50/month minimum contribution also applies but isn't modeled here.",
  },
  secondaryLevy: null,
  tolls: {
    value: { fourPlusAxleHeavy: 0, twoToFourAxleMediumHeavy: 0, abnormalLoad: null },
    source: "Namibia Road Fund Administration (RFA) — road user charges overview",
    asOf: "2026-08-06",
    confidence: "high",
    note: "Namibia funds roads via fuel levies and per-km Mass Distance Charges (MDC) / Cross-Border Charges (CBC) rather than toll gates — confirmed no toll roads exist nationally as of 2026, so this is a genuine zero, though a toll-gate proposal has been under RFA feasibility review. MDC/CBC are ongoing distance-based charges, not a per-trip toll-gate fee, so they aren't modeled in this per-gate toll field.",
  },
};

const mozambique: CountryConfig = {
  code: "MZ",
  name: "Mozambique",
  currencyCode: "MZN",
  currencySymbol: "MT",
  locale: "pt-MZ",
  coverage: "full",
  dieselPricePerLitre: {
    value: 116.25,
    source: "Autoridade Reguladora de Energia (ARENE), national/Maputo-region gasóleo price, corroborated by GlobalPetrolPrices.com",
    asOf: "2026-08-03",
    confidence: "medium",
    note: "ARENE set this price on 8 May 2026 — a ~45% jump from the prior 79.88 MT, driven by import-cost pressure and reduced fuel subsidies — and it was still the prevailing figure as of early August 2026. ARENE publishes regionally differentiated prices; interior/northern provinces (e.g. Niassa) run higher — this is the national/Maputo baseline.",
  },
  incomeTax: {
    value: {
      period: "monthly",
      bands: [
        { from: 0, to: 20250, rate: 0 },
        { from: 20250, to: 22250, rate: 0.1 },
        { from: 22250, to: 32750, rate: 0.15 },
        { from: 32750, to: 60750, rate: 0.2 },
        { from: 60750, to: 144750, rate: 0.25 },
        { from: 144750, to: null, rate: 0.32 },
      ],
      levyOnTaxPercent: 0,
      levyOnTaxLabel: "",
    },
    source: "RSM Moçambique \"Tax Pocket Guide 2026\", reflecting Lei n.º 11/2025 (29 Dec 2025), in force since 1 Jan 2026 — 0-dependents IRPS withholding table",
    asOf: "2026-01-01",
    confidence: "medium",
    note: "IRPS (imposto sobre o rendimento das pessoas singulares) is withheld monthly, unlike the annual bands used elsewhere in this app. The published table also varies the deductible amount by number of dependents (0-4) — this uses the 0-dependents figures, so it will overstate tax for a driver with dependents. The source table finely subdivides the 10% bracket (MT20,250-22,250) into several narrow rows with slightly different precomputed subtractors, collapsed here into one band since they share the same marginal rate.",
  },
  socialSecurity: {
    value: { label: "INSS", employeeRate: 0.03, employerRate: 0.04, employeeCapPerMonth: null },
    source: "RSM Moçambique Tax Pocket Guide 2026, corroborated by INSS's own contribution-rate pages (inss.gov.mz) and Nota n.º 246/INSS/GAB-DG/432/2024",
    asOf: "2026-08-06",
    confidence: "medium",
    note: "3% employee + 4% employer of regular monthly remuneration (profit-sharing, dividends, and one-off/variable payments are explicitly excluded from the base). No cap on insurable earnings or the monthly contribution was found in any source checked — treated here as genuinely uncapped, the best-available reading, though no INSS regulation explicitly confirming the absence of a ceiling was found either.",
  },
  secondaryLevy: {
    value: { label: "Imposto Pessoal Autárquico (IPA)", employeeRate: 1, employeeCapPerMonth: 43 },
    source: "Lei n.º 1/2008 (16 Jan) — municipal personal tax withheld via payroll for First-Category IRPS taxpayers; Maputo figure via O País",
    asOf: "2022-01-03",
    confidence: "low",
    note: "IPA is a flat annual municipal tax (1-4% of the prior year's national minimum wage, set per municipality) collected in monthly instalments through payroll — not a percentage of salary. This engine only supports a rate-of-gross-pay-capped-at-X shape, so it's modeled as employeeRate 100% capped at 43 MT/month, which resolves to a flat 43 MT for any realistic gross pay (a deliberate modeling trick, not a real 100% rate). The only concrete figure found is Maputo City's 2022 annual rate of 510 MT/year (÷12 ≈ 43 MT/month); a 2026 Pemba municipality figure (268 MT/year) shows real municipality-to-municipality variation, and Maputo's current 2026 rate is likely higher given intervening minimum-wage increases — this is a real, confirmed-existing deduction with a stale exact figure, not a fabricated one. Treat as approximate and confirm your specific municipality's current rate before relying on it.",
  },
  tolls: {
    value: { fourPlusAxleHeavy: 1800, twoToFourAxleMediumHeavy: 1200, abnormalLoad: null },
    source: "Trans African Concessions (TRAC), Moamba Toll Plaza, N4 Maputo-Witbank corridor",
    asOf: "2023-09-08",
    confidence: "medium",
    note: "Per single toll-gate passage — Class 3 (3-4 axle trucks) and Class 4 (5+ axle trucks with trailers) rates set 8 September 2023. Mozambican press confirms the government's May 2025 toll-tariff revision explicitly excluded heavy trucks and the Moamba plaza, and no subsequent increase was found through August 2026 — but this couldn't be verified against TRAC's own tariff sheet directly (site unreachable when checked), so treat as the best-evidenced current figure, not a guaranteed-current one.",
  },
};

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
