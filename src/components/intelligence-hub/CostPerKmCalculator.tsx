"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateCostPerKm, type CostPerKmInputs, type CostPerKmResult } from "@/lib/calculators/costPerKm";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type FormState = {
  annualDistanceKm: string;
  fuelPricePerLitre: string;
  fuelConsumptionLPer100Km: string;
  insurance: string;
  socialSecurity: string;
  licensing: string;
  financing: string;
  yardRent: string;
  tyres: string;
  maintenanceReserve: string;
  driverWagesMonthly: string;
  tollsMonthly: string;
};

const emptyState: FormState = {
  annualDistanceKm: "120000",
  fuelPricePerLitre: "",
  fuelConsumptionLPer100Km: "38",
  insurance: "3000",
  socialSecurity: "0",
  licensing: "500",
  financing: "5000",
  yardRent: "1000",
  tyres: "0.9",
  maintenanceReserve: "0.6",
  driverWagesMonthly: "8500",
  tollsMonthly: "1200",
};

/** Diesel price is the one universal cross-currency reference every country has — used as a magnitude proxy to size slider ranges sensibly whether the currency is ZMW (tens) or USD (ones). */
function currencyScale(dieselPricePerLitre: number | undefined): number {
  return dieselPricePerLitre && dieselPricePerLitre > 0 ? dieselPricePerLitre : 25;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function CostPerKmCalculator() {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touchedFuelPrice, setTouchedFuelPrice] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const { country, countryCode, selectCountry } = useSelectedCountry();
  const money = (v: number) => formatMoney(v, country);
  const scale = currencyScale(country.dieselPricePerLitre?.value);

  // Re-baseline the diesel price to the newly selected country's own
  // sourced default on every country switch — otherwise a scenario- or
  // manually-adjusted price from the *previous* country's currency scale
  // (e.g. a Zambia-scale ~K29/L) would carry over verbatim into a country
  // priced on a completely different scale (Zimbabwe's ~US$1.87/L), which
  // is a wrong number, not just a stale one. Every other field
  // deliberately does NOT auto-reset like this — there's no live currency
  // conversion in this product, and a driver-wage or toll figure is the
  // user's own real number to re-enter for the new country, not a
  // sourced default this calculator can intelligently re-baseline.
  //
  // Adjusted directly during render (React's documented pattern for
  // "resetting state when a prop changes") rather than in a useEffect —
  // calling setState synchronously inside an effect body is flagged by
  // this project's lint config as a cascading-render anti-pattern.
  const [prevCountryCode, setPrevCountryCode] = useState(countryCode);
  if (countryCode !== prevCountryCode) {
    setPrevCountryCode(countryCode);
    setTouchedFuelPrice(false);
    setActiveScenario(null);
  }

  const fuelPriceValue =
    !touchedFuelPrice && country.dieselPricePerLitre ? country.dieselPricePerLitre.value.toString() : form.fuelPricePerLitre;

  function set<K extends keyof FormState>(key: K, value: string) {
    if (key === "fuelPricePerLitre") setTouchedFuelPrice(true);
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      {
        label: "Fuel +10%",
        apply: (f) => ({ ...f, fuelPricePerLitre: round2(toNumber(fuelPriceValue) * 1.1) }),
      },
      {
        label: "Fuel −10%",
        apply: (f) => ({ ...f, fuelPricePerLitre: round2(toNumber(fuelPriceValue) * 0.9) }),
      },
      {
        label: "Distance +20%",
        apply: (f) => ({ ...f, annualDistanceKm: Math.round(toNumber(f.annualDistanceKm) * 1.2).toString() }),
      },
      {
        label: "Driver wages +10%",
        apply: (f) => ({ ...f, driverWagesMonthly: round2(toNumber(f.driverWagesMonthly) * 1.1) }),
      },
      {
        label: "Cut maintenance 15%",
        apply: (f) => ({ ...f, maintenanceReserve: round2(toNumber(f.maintenanceReserve) * 0.85) }),
      },
    ],
    [fuelPriceValue]
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setTouchedFuelPrice(true);
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const inputs: CostPerKmInputs = useMemo(
    () => ({
      annualDistanceKm: toNumber(form.annualDistanceKm),
      fuelPricePerLitre: toNumber(fuelPriceValue),
      fuelConsumptionLPer100Km: toNumber(form.fuelConsumptionLPer100Km),
      fixedCostsMonthly: {
        insurance: toNumber(form.insurance),
        socialSecurity: toNumber(form.socialSecurity),
        licensing: toNumber(form.licensing),
        financing: toNumber(form.financing),
        yardRent: toNumber(form.yardRent),
      },
      variableCostsPerKm: {
        tyres: toNumber(form.tyres),
        maintenanceReserve: toNumber(form.maintenanceReserve),
      },
      driverWagesMonthly: toNumber(form.driverWagesMonthly),
      tollsMonthly: toNumber(form.tollsMonthly),
    }),
    [form, fuelPriceValue]
  );

  const result = useMemo(() => calculateCostPerKm(inputs), [inputs]);
  const hasEnoughToShow = inputs.annualDistanceKm > 0 && inputs.fuelConsumptionLPer100Km > 0;

  const chartData = result.breakdown.filter((item) => item.perKm > 0).map((item) => ({ label: item.label, value: item.perKm }));

  function buildAiPrompt(): string {
    const r: CostPerKmResult = result;
    return `Cost Per Kilometre calculation for a truck covering ${inputs.annualDistanceKm.toLocaleString()} km/year (${country.name}, ${country.currencyCode}):
- Fuel: ${money(r.fuelCostPerKm)}/km (${inputs.fuelConsumptionLPer100Km} L/100km at ${money(inputs.fuelPricePerLitre)}/L)
- Fixed costs: ${money(r.fixedCostPerKm)}/km
- Tyres & maintenance: ${money(r.variableCostPerKm)}/km
- Driver wages: ${money(r.driverCostPerKm)}/km
- Tolls: ${money(r.tollCostPerKm)}/km
- Total: ${money(r.totalCostPerKm)}/km, ${money(r.annualTotalCost)}/year`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Cost Per Kilometre</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What does it really cost you to run this truck?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Fuel, fixed monthly
          costs, tyres and maintenance, driver wages, tolls — a real cost
          per kilometre, live. No account, no email, the numbers stay on
          your screen.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Country</legend>
            <div className="mt-4">
              <CountrySelector countryCode={countryCode} onChange={selectCountry} />
            </div>
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Distance &amp; fuel</legend>
            <SliderField
              id="annualDistanceKm"
              label="Annual distance"
              value={toNumber(form.annualDistanceKm)}
              onChange={(v) => set("annualDistanceKm", v.toString())}
              min={0}
              max={300000}
              step={5000}
              unit="km"
            />
            <SliderField
              id="fuelConsumptionLPer100Km"
              label="Fuel consumption"
              value={toNumber(form.fuelConsumptionLPer100Km)}
              onChange={(v) => set("fuelConsumptionLPer100Km", v.toString())}
              min={10}
              max={80}
              step={0.5}
              unit="L/100km"
              hint="From your own fuel logs — this varies by vehicle, load, and route."
            />
            <SliderField
              id="fuelPricePerLitre"
              label="Diesel price"
              value={toNumber(fuelPriceValue)}
              onChange={(v) => set("fuelPricePerLitre", v.toString())}
              min={0}
              max={Math.ceil(scale * 3)}
              step={scale > 10 ? 0.1 : 0.01}
              unit={`${country.currencyCode}/L`}
              hint={
                country.dieselPricePerLitre
                  ? `Pre-filled from Source: ${country.dieselPricePerLitre.source}.`
                  : `Not sourced yet for ${country.name} — enter your own.`
              }
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fixed costs (per month)</legend>
            <SliderField
              id="insurance"
              label="Insurance"
              value={toNumber(form.insurance)}
              onChange={(v) => set("insurance", v.toString())}
              max={Math.ceil(scale * 500)}
              step={Math.max(1, Math.round(scale * 2))}
              unit={country.currencyCode}
            />
            <SliderField
              id="socialSecurity"
              label={country.socialSecurity ? `${country.socialSecurity.value.label} (employer share)` : "Social security (employer share)"}
              value={toNumber(form.socialSecurity)}
              onChange={(v) => set("socialSecurity", v.toString())}
              max={
                country.socialSecurity && country.socialSecurity.value.employeeCapPerMonth !== null
                  ? Math.ceil(country.socialSecurity.value.employeeCapPerMonth * 1.2)
                  : Math.ceil(scale * 100)
              }
              step={Math.max(0.5, Math.round(scale * 0.5))}
              unit={country.currencyCode}
              hint={
                country.socialSecurity
                  ? `${(country.socialSecurity.value.employerRate * 100).toFixed(1)}% of gross, ${
                      country.socialSecurity.value.employeeCapPerMonth === null
                        ? "no cap"
                        : `capped at ${money(country.socialSecurity.value.employeeCapPerMonth)}/month`
                    }. Source: ${country.socialSecurity.source}.`
                  : `Not sourced yet for ${country.name}.`
              }
            />
            <SliderField
              id="licensing"
              label="Licensing & fitness"
              value={toNumber(form.licensing)}
              onChange={(v) => set("licensing", v.toString())}
              max={Math.ceil(scale * 100)}
              step={Math.max(1, Math.round(scale * 0.5))}
              unit={country.currencyCode}
            />
            <SliderField
              id="financing"
              label="Loan / lease repayment"
              value={toNumber(form.financing)}
              onChange={(v) => set("financing", v.toString())}
              max={Math.ceil(scale * 800)}
              step={Math.max(1, Math.round(scale * 4))}
              unit={country.currencyCode}
            />
            <SliderField
              id="yardRent"
              label="Yard rent / overhead"
              value={toNumber(form.yardRent)}
              onChange={(v) => set("yardRent", v.toString())}
              max={Math.ceil(scale * 200)}
              step={Math.max(1, Math.round(scale))}
              unit={country.currencyCode}
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Variable costs (per km)</legend>
            <SliderField
              id="tyres"
              label="Tyres"
              value={toNumber(form.tyres)}
              onChange={(v) => set("tyres", v.toString())}
              max={Math.max(2, Math.ceil(scale / 4))}
              step={scale > 10 ? 0.05 : 0.005}
              unit={`${country.currencyCode}/km`}
            />
            <SliderField
              id="maintenanceReserve"
              label="Maintenance reserve"
              value={toNumber(form.maintenanceReserve)}
              onChange={(v) => set("maintenanceReserve", v.toString())}
              max={Math.max(2, Math.ceil(scale / 4))}
              step={scale > 10 ? 0.05 : 0.005}
              unit={`${country.currencyCode}/km`}
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Driver &amp; tolls (per month)</legend>
            <SliderField
              id="driverWagesMonthly"
              label="Driver wages"
              value={toNumber(form.driverWagesMonthly)}
              onChange={(v) => set("driverWagesMonthly", v.toString())}
              max={Math.ceil(scale * 800)}
              step={Math.max(1, Math.round(scale * 4))}
              unit={country.currencyCode}
            />
            <SliderField
              id="tollsMonthly"
              label="Tolls"
              value={toNumber(form.tollsMonthly)}
              onChange={(v) => set("tollsMonthly", v.toString())}
              max={Math.ceil(scale * 200)}
              step={Math.max(1, Math.round(scale))}
              unit={country.currencyCode}
              hint={
                country.tolls
                  ? `Heavy vehicles (4+ axles) pay ${money(country.tolls.value.fourPlusAxleHeavy)} per toll gate. Source: ${country.tolls.source}.`
                  : `Toll data not sourced yet for ${country.name}.`
              }
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Total cost per kilometre</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  <HeroMetric value={result.totalCostPerKm} formatter={(v) => money(v)} />
                  <span className="text-lg font-medium text-muted">/km</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  <HeroMetric value={result.annualTotalCost} formatter={(v) => money(v)} /> total per year at{" "}
                  {inputs.annualDistanceKm.toLocaleString()} km
                </p>

                <div className="mt-6 border-t border-border pt-4">
                  <MiniBarChart data={chartData} />
                  <div className="mt-2 space-y-1.5">
                    {result.breakdown
                      .filter((item) => item.perKm > 0)
                      .map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted">{item.label}</span>
                          <span className="font-medium text-navy">{money(item.perKm)}/km</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="cost-per-km" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Enter your annual distance and fuel consumption to see your
                  cost per kilometre.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Track this automatically</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet logs fuel, maintenance, and trips as they happen,
              so your real cost per km updates itself — no re-entering
              numbers every month.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/demo" className="btn-primary justify-center text-sm">
                View Demo
              </Link>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center text-sm">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
