"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateCostPerKm, type CostPerKmInputs, type CostPerKmResult } from "@/lib/calculators/costPerKm";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";

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
  fuelConsumptionLPer100Km: "",
  insurance: "",
  socialSecurity: "",
  licensing: "",
  financing: "",
  yardRent: "",
  tyres: "",
  maintenanceReserve: "",
  driverWagesMonthly: "",
  tollsMonthly: "",
};

export default function CostPerKmCalculator() {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touchedFuelPrice, setTouchedFuelPrice] = useState(false);
  const { country, countryCode, selectCountry } = useSelectedCountry();
  const money = (v: number) => formatMoney(v, country);

  const fuelPriceValue =
    !touchedFuelPrice && country.dieselPricePerLitre ? country.dieselPricePerLitre.value.toString() : form.fuelPricePerLitre;

  function set<K extends keyof FormState>(key: K, value: string) {
    if (key === "fuelPricePerLitre") setTouchedFuelPrice(true);
    setForm((prev) => ({ ...prev, [key]: value }));
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
          Fill in what you actually pay — fuel, fixed monthly costs, tyres
          and maintenance, driver wages, tolls — and get a real cost per
          kilometre, broken down by category. No account, no email, the
          numbers stay on your screen.
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

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Distance &amp; fuel</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="annualDistanceKm"
                label="Annual distance (km)"
                value={form.annualDistanceKm}
                onChange={(v) => set("annualDistanceKm", v)}
                step="1000"
              />
              <NumberField
                id="fuelConsumptionLPer100Km"
                label="Fuel consumption (L/100km)"
                value={form.fuelConsumptionLPer100Km}
                onChange={(v) => set("fuelConsumptionLPer100Km", v)}
                placeholder="e.g. 38"
                hint="From your own fuel logs — this varies by vehicle, load, and route, so there's no single correct default."
              />
              <NumberField
                id="fuelPricePerLitre"
                label={`Diesel price (${country.currencyCode}/litre)`}
                value={fuelPriceValue}
                onChange={(v) => set("fuelPricePerLitre", v)}
                hint={
                  country.dieselPricePerLitre
                    ? `Pre-filled from Source: ${country.dieselPricePerLitre.source}. ${country.dieselPricePerLitre.note ?? ""}`
                    : `Not sourced yet for ${country.name} — enter your own.`
                }
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fixed costs (per month)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField id="insurance" label="Insurance" value={form.insurance} onChange={(v) => set("insurance", v)} placeholder="0" />
              <NumberField
                id="socialSecurity"
                label={country.socialSecurity ? `${country.socialSecurity.value.label} (employer share)` : "Social security (employer share)"}
                value={form.socialSecurity}
                onChange={(v) => set("socialSecurity", v)}
                placeholder="0"
                hint={
                  country.socialSecurity
                    ? `${(country.socialSecurity.value.employerRate * 100).toFixed(1)}% of the driver's gross salary, capped at ${money(country.socialSecurity.value.employeeCapPerMonth)}/month. Source: ${country.socialSecurity.source}.`
                    : `Not sourced yet for ${country.name} — enter your own.`
                }
              />
              <NumberField id="licensing" label="Licensing & fitness" value={form.licensing} onChange={(v) => set("licensing", v)} placeholder="0" />
              <NumberField id="financing" label="Loan / lease repayment" value={form.financing} onChange={(v) => set("financing", v)} placeholder="0" />
              <NumberField id="yardRent" label="Yard rent / overhead" value={form.yardRent} onChange={(v) => set("yardRent", v)} placeholder="0" />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Variable costs (per km)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField id="tyres" label={`Tyres (${country.currencyCode}/km)`} value={form.tyres} onChange={(v) => set("tyres", v)} placeholder="0" />
              <NumberField
                id="maintenanceReserve"
                label={`Maintenance reserve (${country.currencyCode}/km)`}
                value={form.maintenanceReserve}
                onChange={(v) => set("maintenanceReserve", v)}
                placeholder="0"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Driver &amp; tolls (per month)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="driverWagesMonthly"
                label="Driver wages"
                value={form.driverWagesMonthly}
                onChange={(v) => set("driverWagesMonthly", v)}
                placeholder="0"
              />
              <NumberField
                id="tollsMonthly"
                label="Tolls"
                value={form.tollsMonthly}
                onChange={(v) => set("tollsMonthly", v)}
                placeholder="0"
                hint={
                  country.tolls
                    ? `Heavy vehicles (4+ axles) pay ${money(country.tolls.value.fourPlusAxleHeavy)} per toll gate — multiply by gates on your route, not distance. Source: ${country.tolls.source}.`
                    : `Toll data not sourced yet for ${country.name}.`
                }
              />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Total cost per kilometre</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  {money(result.totalCostPerKm)}
                  <span className="text-lg font-medium text-muted">/km</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {money(result.annualTotalCost)} total per year at {inputs.annualDistanceKm.toLocaleString()} km
                </p>

                <div className="mt-6 space-y-3">
                  {result.breakdown
                    .filter((item) => item.perKm > 0)
                    .map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-body">{item.label}</span>
                          <span className="font-medium text-navy">{money(item.perKm)}/km</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border-soft" style={{ background: "var(--df-border)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(item.share * 100)}%`, background: "var(--df-gradient-brand)" }}
                          />
                        </div>
                      </div>
                    ))}
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
