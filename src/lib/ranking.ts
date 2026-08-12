import {
  RANKING_COMPONENT_META,
  type Prospect,
  type ProspectRank,
  type RankComponent,
  type RankComponentScore,
  type RankedProspect,
  type RankingWeights,
} from "./crmTypes";

/**
 * Revenue OS RS-1 §5.7 — the deterministic Daily Prospect Engine. A pure
 * function of a prospect's existing fields plus a small context object;
 * no Firebase, no network, no AI — so it's unit-testable in isolation and
 * is exactly what ships when no AI provider is configured (§6). The
 * optional AI re-rank layer lives in the Today route, on top of this
 * order, never in place of it.
 */

export type WhatsAppUrgency = "low" | "medium" | "high" | "urgent";

export interface RankingContext {
  /** Today's date as YYYY-MM-DD (UTC). */
  today: string;
  /** Lowercased terms from active directives/campaigns, for strategicRelevance matching. */
  strategicTerms: string[];
  /** Per-prospect WhatsApp "awaiting response" urgency, if any (keyed by prospect id). */
  whatsappUrgencyByProspect?: Record<string, WhatsAppUrgency>;
}

const LABEL = Object.fromEntries(RANKING_COMPONENT_META.map((m) => [m.key, m.label])) as Record<RankComponent, string>;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

const WHATSAPP_URGENCY_SIGNAL: Record<WhatsAppUrgency, number> = { low: 0.3, medium: 0.5, high: 0.8, urgent: 1 };

/** Normalize raw percentage weights to fractions summing to 1. Falls back to an even split if every weight is zero. */
export function normalizeWeights(weights: RankingWeights): Record<RankComponent, number> {
  const total = RANKING_COMPONENT_META.reduce((sum, m) => sum + Math.max(0, weights[m.key] || 0), 0);
  const out = {} as Record<RankComponent, number>;
  for (const { key } of RANKING_COMPONENT_META) {
    out[key] = total > 0 ? Math.max(0, weights[key] || 0) / total : 1 / RANKING_COMPONENT_META.length;
  }
  return out;
}

/** The raw 0–1 signal for each component — deterministic derivations from existing prospect fields (§5.7's table). */
export function componentSignals(prospect: Prospect, ctx: RankingContext): Record<RankComponent, number> {
  // icpFit — icpFitScore is 0–100; unknown fit contributes nothing rather than a guessed midpoint.
  const icpFit = clamp01((prospect.icpFitScore ?? 0) / 100);

  // engagement — RS-1 proxy is the promotion-time visitor snapshot; the
  // live visitor link is RS-4a. No snapshot → no engagement signal.
  const engagement = clamp01((prospect.visitorSnapshot?.engagementScore ?? 0) / 100);

  // followUpUrgency — how overdue the next action is (saturating at 14 days),
  // OR any WhatsApp awaiting a reply, whichever is more urgent.
  let overdueSignal = 0;
  if (prospect.nextActionDate) {
    const overdueDays = daysBetween(prospect.nextActionDate, ctx.today);
    if (overdueDays > 0) overdueSignal = clamp01(overdueDays / 14);
    else if (overdueDays === 0) overdueSignal = 0.5; // due today
  }
  const waUrgency = ctx.whatsappUrgencyByProspect?.[prospect.id];
  const whatsappSignal = waUrgency ? WHATSAPP_URGENCY_SIGNAL[waUrgency] : 0;
  const followUpUrgency = Math.max(overdueSignal, whatsappSignal);

  // buyingIntent — opportunityScore is 0–100, already fed by WhatsApp buying signals.
  const buyingIntent = clamp01((prospect.opportunityScore ?? 0) / 100);

  // strategicRelevance — binary: does any active directive/campaign term
  // appear in this prospect's stated ICP text? (substring match, no AI.)
  const haystack = [prospect.name, prospect.location, prospect.estimatedFleetSizeRaw, prospect.primaryPainRaw]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .toLowerCase();
  const strategicRelevance = ctx.strategicTerms.some((term) => term.length >= 3 && haystack.includes(term)) ? 1 : 0;

  // contactability — channels on file, weighted toward a verified WhatsApp.
  let contactability = 0;
  if (prospect.contactPhone) contactability += 0.4;
  if (prospect.whatsappStatus === "verified" && !prospect.whatsappOptedOut) contactability += 0.4;
  else if (prospect.contactWhatsapp) contactability += 0.2;
  if (prospect.contactEmail) contactability += 0.2;
  contactability = clamp01(contactability);

  // recency — momentum: a recently-touched prospect scores higher (a
  // conversation in motion). Never-contacted decays to ~0.
  const daysSinceContact = prospect.lastContactDate ? Math.max(0, daysBetween(prospect.lastContactDate, ctx.today)) : 999;
  const recency = clamp01(1 / (1 + daysSinceContact));

  return { icpFit, engagement, followUpUrgency, buyingIntent, strategicRelevance, contactability, recency };
}

function reasonFor(component: RankComponent, prospect: Prospect, ctx: RankingContext, signal: number): string | null {
  switch (component) {
    case "icpFit":
      return "Strong ICP fit";
    case "engagement":
      return "Active on the website";
    case "followUpUrgency": {
      const wa = ctx.whatsappUrgencyByProspect?.[prospect.id];
      if (wa && WHATSAPP_URGENCY_SIGNAL[wa] >= signal) return "WhatsApp awaiting a reply";
      if (prospect.nextActionDate) {
        const overdueDays = daysBetween(prospect.nextActionDate, ctx.today);
        if (overdueDays > 0) return `Overdue ${overdueDays}d`;
        if (overdueDays === 0) return "Due today";
      }
      return "Follow-up due";
    }
    case "buyingIntent":
      return "High buying intent";
    case "strategicRelevance":
      return "Matches an active directive";
    case "contactability":
      return null; // a supporting factor, not a headline reason
    case "recency":
      return "Recent momentum";
  }
}

export function scoreProspect(prospect: Prospect, weights: RankingWeights, ctx: RankingContext): ProspectRank {
  const normalized = normalizeWeights(weights);
  const signals = componentSignals(prospect, ctx);

  const breakdown: RankComponentScore[] = RANKING_COMPONENT_META.map(({ key }) => {
    const signal = signals[key];
    const weight = normalized[key];
    return { component: key, label: LABEL[key], signal, weight, contribution: signal * weight * 100 };
  });

  const score = Math.round(breakdown.reduce((sum, b) => sum + b.contribution, 0) * 10) / 10;

  // Top reasons: highest-contributing components whose signal is meaningful.
  const reasons = [...breakdown]
    .filter((b) => b.signal >= 0.34 && b.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .map((b) => reasonFor(b.component, prospect, ctx, b.signal))
    .filter((r): r is string => r !== null)
    .slice(0, 3);

  return { score, breakdown, reasons, aiAdjusted: false };
}

/** Rank a candidate set descending by deterministic score. Ties broken by the older next-action date first (the queue's original ordering), keeping behavior stable. */
export function rankProspects(prospects: Prospect[], weights: RankingWeights, ctx: RankingContext): RankedProspect[] {
  return prospects
    .map((p) => ({ ...p, rank: scoreProspect(p, weights, ctx) }))
    .sort((a, b) => {
      if (b.rank.score !== a.rank.score) return b.rank.score - a.rank.score;
      return (a.nextActionDate ?? "9999-12-31") < (b.nextActionDate ?? "9999-12-31") ? -1 : 1;
    });
}
