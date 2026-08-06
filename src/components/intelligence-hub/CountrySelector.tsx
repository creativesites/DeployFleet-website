"use client";

import { motion, AnimatePresence } from "framer-motion";
import { COUNTRY_LIST, type CountryCode, type CountryConfig } from "@/lib/countries";

export function CountrySelector({
  countryCode,
  onChange,
}: {
  countryCode: CountryCode;
  onChange: (code: CountryCode) => void;
}) {
  const selected = COUNTRY_LIST.find((c) => c.code === countryCode);

  return (
    <div>
      <label htmlFor="country-selector" className="text-sm font-medium text-navy">
        Country
      </label>
      <select
        id="country-selector"
        value={countryCode}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-4 py-3 text-sm text-navy outline-none focus:border-teal"
      >
        {COUNTRY_LIST.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.currencyCode})
          </option>
        ))}
      </select>
      <AnimatePresence mode="wait">
        {selected && selected.coverage !== "full" && (
          <motion.p
            key={selected.code}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 overflow-hidden text-xs text-amber"
          >
            Tax and toll data for {selected.name} isn&apos;t sourced yet — this calculator will run in{" "}
            {selected.currencyCode}, but country-specific figures below won&apos;t apply.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function coverageBadge(country: CountryConfig): { label: string; className: string } | null {
  if (country.coverage === "full") return null;
  return {
    label: `${country.currencyCode} only`,
    className: "bg-[color-mix(in_srgb,var(--df-amber)_14%,transparent)] text-amber",
  };
}
