"use client";

import { motion } from "framer-motion";

/**
 * Replaces a plain NumberField for discrete counts (trucks, retreads,
 * axle groups). [ − ] value [ + ] pill, 44px touch targets — the
 * established mobile-first minimum elsewhere in this project. Falls back
 * to the same underlying number semantics for keyboard/screen-reader
 * users via the visible, focusable center value (itself directly
 * editable on tap, same precision-first principle as SliderField).
 */
export function StepperField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  function clamp(v: number): number {
    let next = v;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  }

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}
      </label>
      <div className="mt-1.5 flex items-stretch overflow-hidden rounded-df-md border border-border">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`Decrease ${label}`}
          className="flex w-11 shrink-0 items-center justify-center bg-canvas text-lg font-semibold text-navy transition-colors hover:bg-border-soft active:bg-border"
          style={{ minHeight: 44 }}
        >
          −
        </button>
        <motion.input
          key={value}
          initial={{ backgroundColor: "color-mix(in srgb, var(--df-teal) 10%, transparent)" }}
          animate={{ backgroundColor: "rgba(0,0,0,0)" }}
          transition={{ duration: 0.35 }}
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-full min-w-0 flex-1 border-x border-border px-2 py-2 text-center text-sm font-semibold tabular-nums text-navy outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`Increase ${label}`}
          className="flex w-11 shrink-0 items-center justify-center bg-canvas text-lg font-semibold text-navy transition-colors hover:bg-border-soft active:bg-border"
          style={{ minHeight: 44 }}
        >
          +
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
