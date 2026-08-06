"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";

/**
 * The animated big number every calculator's results panel leads with.
 * Counts through intermediate values on change rather than jumping
 * instantly — "controls -> live dashboard -> insights," not "forms ->
 * numbers -> buttons." Updates the DOM directly via framer-motion's
 * imperative `animate()` (not React state per frame) for performance —
 * a spreadsheet-heavy page re-rendering the whole tree 60 times a second
 * would be the opposite of "feels expensive." Snaps instantly rather
 * than animating when the user has prefers-reduced-motion set.
 */
export function HeroMetric({
  value,
  formatter,
  className,
}: {
  value: number;
  formatter: (v: number) => string;
  className?: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(value);
  const shouldReduceMotion = useReducedMotion();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (spanRef.current && isFirstRender.current) {
      spanRef.current.textContent = formatter(value);
    }
    isFirstRender.current = false;
  }, [formatter, value]);

  useEffect(() => {
    if (shouldReduceMotion) {
      motionValue.set(value);
      if (spanRef.current) spanRef.current.textContent = formatter(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (spanRef.current) spanRef.current.textContent = formatter(latest);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={spanRef} className={className}>
      {formatter(value)}
    </span>
  );
}
