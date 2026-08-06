"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * Replaces a plain NumberField for continuous values (fuel price,
 * distance, rate) — the "controls" layer of the Fleet Control Panel
 * redesign. Built on a native input[type=range] for accessibility
 * (keyboard arrows, screen readers) with CSS handling the thumb/track
 * look (see .df-slider in globals.css); the fill gradient itself is
 * computed inline since it depends on the live value. The numeric label
 * is always directly editable on tap — precision typing is never
 * sacrificed for tactility, per the design plan's "hybrid" recommendation.
 */
export function SliderField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const clamped = Math.max(min, Math.min(max, value));
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
        {editing ? (
          <input
            type="number"
            autoFocus
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            className="w-24 rounded-df-md border border-teal px-2 py-1 text-right text-sm font-semibold text-navy outline-none"
          />
        ) : (
          <motion.button
            type="button"
            key={value}
            initial={{ scale: 1.08, color: "var(--df-teal)" }}
            animate={{ scale: 1, color: "var(--df-navy)" }}
            transition={{ duration: 0.2 }}
            onClick={() => setEditing(true)}
            className="rounded-df-md px-1.5 py-0.5 text-sm font-semibold tabular-nums"
          >
            {value.toLocaleString()}
            {unit ? ` ${unit}` : ""}
          </motion.button>
        )}
      </div>
      <input
        id={id}
        type="range"
        className="df-slider mt-2"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--df-cyan) 0%, var(--df-teal) ${percent}%, var(--df-border) ${percent}%, var(--df-border) 100%)`,
        }}
      />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
