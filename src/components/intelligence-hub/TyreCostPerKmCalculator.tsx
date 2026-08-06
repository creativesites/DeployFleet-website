"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateTyreCostPerKm, type TyreOptionInputs } from "@/lib/calculators/tyreCostPerKm";
import { whatsappHref } from "@/lib/nav";
import { toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { StepperField } from "@/components/intelligence-hub/StepperField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type OptionFormState = {
  purchasePriceZmw: string;
  expectedLifeKm: string;
  numberOfRetreads: string;
  retreadCostZmw: string;
  retreadLifeKm: string;
};

const budgetDefault: OptionFormState = {
  purchasePriceZmw: "2800",
  expectedLifeKm: "50000",
  numberOfRetreads: "1",
  retreadCostZmw: "1200",
  retreadLifeKm: "35000",
};

const premiumDefault: OptionFormState = {
  purchasePriceZmw: "4500",
  expectedLifeKm: "80000",
  numberOfRetreads: "2",
  retreadCostZmw: "1500",
  retreadLifeKm: "50000",
};

type AllState = {
  budget: OptionFormState;
  premium: OptionFormState;
  tyrePositions: string;
  annualDistanceKm: string;
};

function toOptionInputs(form: OptionFormState): TyreOptionInputs {
  return {
    purchasePriceZmw: toNumber(form.purchasePriceZmw),
    expectedLifeKm: toNumber(form.expectedLifeKm),
    numberOfRetreads: toNumber(form.numberOfRetreads),
    retreadCostZmw: toNumber(form.retreadCostZmw),
    retreadLifeKm: toNumber(form.retreadLifeKm),
  };
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function OptionFieldset({
  title,
  idPrefix,
  form,
  onChange,
}: {
  title: string;
  idPrefix: string;
  form: OptionFormState;
  onChange: (key: keyof OptionFormState, value: string) => void;
}) {
  return (
    <fieldset className="card-surface space-y-6 p-6">
      <legend className="px-1 text-sm font-semibold text-navy">{title}</legend>
      <SliderField
        id={`${idPrefix}-price`}
        label="Purchase price"
        value={toNumber(form.purchasePriceZmw)}
        onChange={(v) => onChange("purchasePriceZmw", v.toString())}
        max={15000}
        step={100}
        unit="ZMW"
      />
      <SliderField
        id={`${idPrefix}-life`}
        label="Expected life"
        value={toNumber(form.expectedLifeKm)}
        onChange={(v) => onChange("expectedLifeKm", v.toString())}
        max={150000}
        step={1000}
        unit="km"
      />
      <StepperField
        id={`${idPrefix}-retreads`}
        label="Number of retreads"
        value={toNumber(form.numberOfRetreads)}
        onChange={(v) => onChange("numberOfRetreads", v.toString())}
        min={0}
        max={5}
        step={1}
      />
      <SliderField
        id={`${idPrefix}-retreadCost`}
        label="Cost per retread"
        value={toNumber(form.retreadCostZmw)}
        onChange={(v) => onChange("retreadCostZmw", v.toString())}
        max={5000}
        step={50}
        unit="ZMW"
      />
      <SliderField
        id={`${idPrefix}-retreadLife`}
        label="Life per retread"
        value={toNumber(form.retreadLifeKm)}
        onChange={(v) => onChange("retreadLifeKm", v.toString())}
        max={100000}
        step={1000}
        unit="km"
      />
    </fieldset>
  );
}

export default function TyreCostPerKmCalculator() {
  const [budget, setBudget] = useState<OptionFormState>(budgetDefault);
  const [premium, setPremium] = useState<OptionFormState>(premiumDefault);
  const [tyrePositions, setTyrePositions] = useState("10");
  const [annualDistanceKm, setAnnualDistanceKm] = useState("120000");
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  function updateBudget(key: keyof OptionFormState, value: string) {
    setActiveScenario(null);
    setBudget((prev) => ({ ...prev, [key]: value }));
  }
  function updatePremium(key: keyof OptionFormState, value: string) {
    setActiveScenario(null);
    setPremium((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<AllState>[] = useMemo(
    () => [
      { label: "Budget price +10%", apply: (s) => ({ ...s, budget: { ...s.budget, purchasePriceZmw: round2(toNumber(s.budget.purchasePriceZmw) * 1.1) } }) },
      { label: "Premium life +20%", apply: (s) => ({ ...s, premium: { ...s.premium, expectedLifeKm: Math.round(toNumber(s.premium.expectedLifeKm) * 1.2).toString() } }) },
      { label: "Distance +20%", apply: (s) => ({ ...s, annualDistanceKm: Math.round(toNumber(s.annualDistanceKm) * 1.2).toString() }) },
      { label: "Budget retread cost +15%", apply: (s) => ({ ...s, budget: { ...s.budget, retreadCostZmw: round2(toNumber(s.budget.retreadCostZmw) * 1.15) } }) },
      { label: "Add a retread to premium", apply: (s) => ({ ...s, premium: { ...s.premium, numberOfRetreads: (toNumber(s.premium.numberOfRetreads) + 1).toString() } }) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<AllState>) {
    const next = scenario.apply({ budget, premium, tyrePositions, annualDistanceKm });
    setBudget(next.budget);
    setPremium(next.premium);
    setTyrePositions(next.tyrePositions);
    setAnnualDistanceKm(next.annualDistanceKm);
    setActiveScenario(scenario.label);
  }

  const result = useMemo(
    () =>
      calculateTyreCostPerKm({
        budget: toOptionInputs(budget),
        premium: toOptionInputs(premium),
        tyrePositionsOnVehicle: toNumber(tyrePositions),
        annualDistanceKm: toNumber(annualDistanceKm),
      }),
    [budget, premium, tyrePositions, annualDistanceKm]
  );

  const hasEnoughToShow =
    toNumber(budget.purchasePriceZmw) > 0 &&
    toNumber(budget.expectedLifeKm) > 0 &&
    toNumber(premium.purchasePriceZmw) > 0 &&
    toNumber(premium.expectedLifeKm) > 0;

  const chartData = [
    { label: "Budget", value: result.budget.costPerKmZmw },
    { label: "Premium", value: result.premium.costPerKmZmw },
  ];

  function buildAiPrompt(): string {
    return `Tyre cost-per-km comparison, ${tyrePositions} tyre positions, ${Number(annualDistanceKm).toLocaleString()} km/year:
- Budget: ${formatZmw(result.budget.costPerKmZmw)}/km over ${result.budget.totalLifecycleKm.toLocaleString()} km lifecycle, ${formatZmw(result.budget.annualCostPerVehicleZmw)}/year per vehicle
- Premium: ${formatZmw(result.premium.costPerKmZmw)}/km over ${result.premium.totalLifecycleKm.toLocaleString()} km lifecycle, ${formatZmw(result.premium.annualCostPerVehicleZmw)}/year per vehicle
- Cheaper option: ${result.cheaperOption}
- Annual savings per vehicle from the cheaper option: ${formatZmw(Math.abs(result.annualSavingsPerVehicleZmw))}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Tyre Cost Per Kilometre</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Budget or premium tyres — which actually costs less?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Sticker price alone
          doesn&apos;t answer this. Purchase price, retreads, and the km
          each option actually delivers — compared on cost per kilometre,
          over the tyre&apos;s full working life.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <OptionFieldset title="Budget option" idPrefix="budget" form={budget} onChange={updateBudget} />
          <OptionFieldset title="Premium option" idPrefix="premium" form={premium} onChange={updatePremium} />

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Vehicle</legend>
            <StepperField
              id="tyrePositions"
              label="Tyre positions on vehicle"
              value={toNumber(tyrePositions)}
              onChange={(v) => {
                setActiveScenario(null);
                setTyrePositions(v.toString());
              }}
              min={2}
              max={22}
              step={1}
              hint="e.g. 6 for a rigid truck, 10-18 for an articulated truck+trailer combination."
            />
            <SliderField
              id="annualDistanceKm"
              label="Annual distance"
              value={toNumber(annualDistanceKm)}
              onChange={(v) => {
                setActiveScenario(null);
                setAnnualDistanceKm(v.toString());
              }}
              max={300000}
              step={5000}
              unit="km"
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Cheaper option</p>
                <p className="mt-1 text-3xl font-bold capitalize text-navy">
                  {result.cheaperOption === "equal" ? "Equal cost" : result.cheaperOption}
                </p>
                {result.cheaperOption !== "equal" && (
                  <p className="mt-1 text-sm text-muted">
                    Saves <HeroMetric value={Math.abs(result.annualSavingsPerVehicleZmw)} formatter={(v) => formatZmw(v)} />
                    /year per vehicle
                  </p>
                )}

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cost per kilometre</p>
                  <div className="mt-2">
                    <MiniBarChart data={chartData} />
                  </div>
                </div>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Budget cost/km</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.budget.costPerKmZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Premium cost/km</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.premium.costPerKmZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Budget lifecycle</dt>
                    <dd className="font-medium text-navy">{result.budget.totalLifecycleKm.toLocaleString()} km</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Premium lifecycle</dt>
                    <dd className="font-medium text-navy">{result.premium.totalLifecycleKm.toLocaleString()} km</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-soft pt-3">
                    <dt className="text-body">Budget annual cost/vehicle</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.budget.annualCostPerVehicleZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Premium annual cost/vehicle</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.premium.annualCostPerVehicleZmw)}</dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="tyre-cost" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Fill in a purchase price and expected life for both options to compare.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Track real tyre cost per vehicle</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet logs tyre position, tread depth, and retread
              history per vehicle — so this comparison can run on your
              fleet&apos;s real numbers.
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
