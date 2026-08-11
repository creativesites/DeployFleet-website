import type { EventType } from "../visitorTypes";

/**
 * Spec §8/§21 — engagement vs. intent are deliberately separate scores.
 * Engagement measures general usage volume; intent measures specific
 * buying-signal actions. Weights live here, in one place, rather than
 * scattered across every call site that touches a visitor record —
 * "configurable rather than hard-coded" per spec §8/§39, even though
 * today that configuration is a constant, not an admin-editable setting.
 *
 * Both scores are accumulated incrementally as events happen (see
 * applyEventToScores() in visitorIntelligence.ts) rather than recomputed
 * from full event history each time — cheaper, and avoids an unbounded
 * per-visitor event read on every hit. This is a deliberate v1 tradeoff:
 * it means a score can't be recalculated retroactively if the weights
 * change, only decays/grows going forward. Acceptable at this data
 * volume; worth revisiting if scores ever need to be backfillable.
 */

export const ENGAGEMENT_WEIGHTS: Partial<Record<EventType, number>> = {
  page_view: 2,
  scroll: 3,
  engaged_view: 5,
  cta_click: 6,
  form_start: 6,
  calculator_start: 8,
  calculator_complete: 12,
  pricing_view: 8,
  whatsapp_click: 10,
  phone_click: 10,
  demo_request: 15,
  contact_request: 12,
  download: 6,
  video_complete: 8,
};

/** Extra engagement credit for a session beyond the visitor's first — rewards returning, not just active, visitors. */
export const RETURNING_SESSION_ENGAGEMENT_BONUS = 8;

export const INTENT_WEIGHTS: Partial<Record<EventType, number>> = {
  // Spec §21's explicit list.
  page_view: 1, // "+5 viewed product page" is folded into pricing/feature-page-specific events below instead of every page_view
  pricing_view: 10,
  calculator_start: 5,
  calculator_complete: 10,
  whatsapp_click: 20,
  phone_click: 20,
  demo_request: 30,
  contact_request: 25,
  form_submit: 10,
};

export const RETURNING_SESSION_INTENT_BONUS = 15;

export const SCORE_MAX = 100;

export function clampScore(value: number): number {
  return Math.max(0, Math.min(SCORE_MAX, Math.round(value)));
}

export type EngagementBand = "low" | "moderate" | "engaged" | "highly-engaged" | "high-intent";

/** Spec §8's banding — reuses the same 0-100 scale for the label lookup. */
export function engagementBand(score: number): EngagementBand {
  if (score >= 90) return "high-intent";
  if (score >= 70) return "highly-engaged";
  if (score >= 40) return "engaged";
  if (score >= 20) return "moderate";
  return "low";
}

export type IntentCategory = "cold" | "warm" | "interested" | "high-intent" | "sales-ready";

/** Spec §21's intent categories. */
export function intentCategory(score: number): IntentCategory {
  if (score >= 80) return "sales-ready";
  if (score >= 60) return "high-intent";
  if (score >= 35) return "interested";
  if (score >= 15) return "warm";
  return "cold";
}
