"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateTyreCostPerKm, type TyreOptionInputs } from "@/lib/calculators/tyreCostPerKm";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type OptionFormState = {
  purchasePriceZmw: string;
  expectedLifeKm: string;
  numberOfRetreads: string;
  retreadCostZmw: string;
  retreadLifeKm: string;
};

const emptyOption: OptionFormState = {
  purchasePriceZmw: "",
  expectedLifeKm: "",
  numberOfRetreads: "0",
  retreadCostZmw: "",
  retreadLifeKm: "",
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
    <fieldset className="card-surface p-6">
      <legend className="px-1 text-sm font-semibold text-navy">{title}</legend>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-price`}
          label="Purchase price (ZMW)"
          value={form.purchasePriceZmw}
          onChange={(v) => onChange("purchasePriceZmw", v)}
          placeholder="e.g. 3500"
        />
        <NumberField
          id={`${idPrefix}-life`}
          label="Expected life (km)"
          value={form.expectedLifeKm}
          onChange={(v) => onChange("expectedLifeKm", v)}
          placeholder="e.g. 60000"
          step="1000"
        />
        <NumberField
          id={`${idPrefix}-retreads`}
          label="Number of retreads"
          value={form.numberOfRetreads}
          onChange={(v) => onChange("numberOfRetreads", v)}
          step="1"
        />
        <NumberField
          id={`${idPrefix}-retreadCost`}
          label="Cost per retread (ZMW)"
          value={form.retreadCostZmw}
          onChange={(v) => onChange("retreadCostZmw", v)}
          placeholder="0"
        />
        <NumberField
          id={`${idPrefix}-retreadLife`}
          label="Life per retread (km)"
          value={form.retreadLifeKm}
          onChange={(v) => onChange("retreadLifeKm", v)}
          placeholder="0"
          step="1000"
        />
      </div>
    </fieldset>
  );
}

export default function TyreCostPerKmCalculator() {
  const [budget, setBudget] = useState<OptionFormState>(emptyOption);
  const [premium, setPremium] = useState<OptionFormState>(emptyOption);
  const [tyrePositions, setTyrePositions] = useState("10");
  const [annualDistanceKm, setAnnualDistanceKm] = useState("120000");

  function updateBudget(key: keyof OptionFormState, value: string) {
    setBudget((prev) => ({ ...prev, [key]: value }));
  }
  function updatePremium(key: keyof OptionFormState, value: string) {
    setPremium((prev) => ({ ...prev, [key]: value }));
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
          Sticker price alone doesn&apos;t answer this. Purchase price,
          retreads, and the km each option actually delivers — compared on
          cost per kilometre, over the tyre&apos;s full working life.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <OptionFieldset title="Budget option" idPrefix="budget" form={budget} onChange={updateBudget} />
          <OptionFieldset title="Premium option" idPrefix="premium" form={premium} onChange={updatePremium} />

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Vehicle</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="tyrePositions"
                label="Tyre positions on vehicle"
                value={tyrePositions}
                onChange={setTyrePositions}
                step="1"
                hint="e.g. 6 for a rigid truck, 10-18 for an articulated truck+trailer combination."
              />
              <NumberField
                id="annualDistanceKm"
                label="Annual distance (km)"
                value={annualDistanceKm}
                onChange={setAnnualDistanceKm}
                step="1000"
              />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Cheaper option</p>
                <p className="mt-1 text-3xl font-bold capitalize text-navy">
                  {result.cheaperOption === "equal" ? "Equal cost" : result.cheaperOption}
                </p>
                {result.cheaperOption !== "equal" && (
                  <p className="mt-1 text-sm text-muted">
                    Saves {formatZmw(Math.abs(result.annualSavingsPerVehicleZmw))}/year per vehicle
                  </p>
                )}

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
