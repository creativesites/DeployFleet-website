"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateCostPerKm, type CostPerKmInputs } from "@/lib/calculators/costPerKm";
import { DIESEL_PRICE_ZMW_PER_LITRE, NAPSA, HEAVY_VEHICLE_TOLLS, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import type { CostPerKmResult } from "@/lib/calculators/costPerKm";

type FormState = {
  annualDistanceKm: string;
  fuelPriceZmwPerLitre: string;
  fuelConsumptionLPer100Km: string;
  insurance: string;
  napsa: string;
  licensing: string;
  financing: string;
  yardRent: string;
  tyres: string;
  maintenanceReserve: string;
  driverWagesMonthlyZmw: string;
  tollsMonthlyZmw: string;
};

const initialState: FormState = {
  annualDistanceKm: "120000",
  fuelPriceZmwPerLitre: DIESEL_PRICE_ZMW_PER_LITRE.value.toString(),
  fuelConsumptionLPer100Km: "",
  insurance: "",
  napsa: "",
  licensing: "",
  financing: "",
  yardRent: "",
  tyres: "",
  maintenanceReserve: "",
  driverWagesMonthlyZmw: "",
  tollsMonthlyZmw: "",
};

export default function CostPerKmCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputs: CostPerKmInputs = useMemo(
    () => ({
      annualDistanceKm: toNumber(form.annualDistanceKm),
      fuelPriceZmwPerLitre: toNumber(form.fuelPriceZmwPerLitre),
      fuelConsumptionLPer100Km: toNumber(form.fuelConsumptionLPer100Km),
      fixedCostsMonthlyZmw: {
        insurance: toNumber(form.insurance),
        napsa: toNumber(form.napsa),
        licensing: toNumber(form.licensing),
        financing: toNumber(form.financing),
        yardRent: toNumber(form.yardRent),
      },
      variableCostsPerKmZmw: {
        tyres: toNumber(form.tyres),
        maintenanceReserve: toNumber(form.maintenanceReserve),
      },
      driverWagesMonthlyZmw: toNumber(form.driverWagesMonthlyZmw),
      tollsMonthlyZmw: toNumber(form.tollsMonthlyZmw),
    }),
    [form]
  );

  const result = useMemo(() => calculateCostPerKm(inputs), [inputs]);
  const hasEnoughToShow = inputs.annualDistanceKm > 0 && inputs.fuelConsumptionLPer100Km > 0;

  function buildAiPrompt(): string {
    const r: CostPerKmResult = result;
    return `Cost Per Kilometre calculation for a truck covering ${inputs.annualDistanceKm.toLocaleString()} km/year:
- Fuel: ${formatZmw(r.fuelCostPerKmZmw)}/km (${inputs.fuelConsumptionLPer100Km} L/100km at K${inputs.fuelPriceZmwPerLitre}/L)
- Fixed costs: ${formatZmw(r.fixedCostPerKmZmw)}/km
- Tyres & maintenance: ${formatZmw(r.variableCostPerKmZmw)}/km
- Driver wages: ${formatZmw(r.driverCostPerKmZmw)}/km
- Tolls: ${formatZmw(r.tollCostPerKmZmw)}/km
- Total: ${formatZmw(r.totalCostPerKmZmw)}/km, ${formatZmw(r.annualTotalCostZmw)}/year`;
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
                id="fuelPriceZmwPerLitre"
                label="Diesel price (ZMW/litre)"
                value={form.fuelPriceZmwPerLitre}
                onChange={(v) => set("fuelPriceZmwPerLitre", v)}
                hint={`Pre-filled from ${formatSourceLabel(DIESEL_PRICE_ZMW_PER_LITRE)}. ${DIESEL_PRICE_ZMW_PER_LITRE.note ?? ""}`}
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fixed costs (per month)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField id="insurance" label="Insurance" value={form.insurance} onChange={(v) => set("insurance", v)} placeholder="0" />
              <NumberField
                id="napsa"
                label="NAPSA (employer share)"
                value={form.napsa}
                onChange={(v) => set("napsa", v)}
                placeholder="0"
                hint={`${(NAPSA.value.employerRate * 100).toFixed(0)}% of the driver's gross salary, capped at ${formatZmw(NAPSA.value.employerCapZmw)}/month. ${formatSourceLabel(NAPSA)}.`}
              />
              <NumberField id="licensing" label="Licensing & fitness" value={form.licensing} onChange={(v) => set("licensing", v)} placeholder="0" />
              <NumberField id="financing" label="Loan / lease repayment" value={form.financing} onChange={(v) => set("financing", v)} placeholder="0" />
              <NumberField id="yardRent" label="Yard rent / overhead" value={form.yardRent} onChange={(v) => set("yardRent", v)} placeholder="0" />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Variable costs (per km)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField id="tyres" label="Tyres (ZMW/km)" value={form.tyres} onChange={(v) => set("tyres", v)} placeholder="0" />
              <NumberField
                id="maintenanceReserve"
                label="Maintenance reserve (ZMW/km)"
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
                id="driverWagesMonthlyZmw"
                label="Driver wages"
                value={form.driverWagesMonthlyZmw}
                onChange={(v) => set("driverWagesMonthlyZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="tollsMonthlyZmw"
                label="Tolls"
                value={form.tollsMonthlyZmw}
                onChange={(v) => set("tollsMonthlyZmw", v)}
                placeholder="0"
                hint={`Heavy vehicles (4+ axles) pay ${formatZmw(HEAVY_VEHICLE_TOLLS.value.fourPlusAxleHeavyZmw)} per toll gate — multiply by gates on your route, not distance. ${formatSourceLabel(HEAVY_VEHICLE_TOLLS)}.`}
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
                  {formatZmw(result.totalCostPerKmZmw)}
                  <span className="text-lg font-medium text-muted">/km</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatZmw(result.annualTotalCostZmw)} total per year at {inputs.annualDistanceKm.toLocaleString()} km
                </p>

                <div className="mt-6 space-y-3">
                  {result.breakdown
                    .filter((item) => item.perKmZmw > 0)
                    .map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-body">{item.label}</span>
                          <span className="font-medium text-navy">{formatZmw(item.perKmZmw)}/km</span>
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
