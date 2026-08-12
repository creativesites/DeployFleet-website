import { describe, expect, it } from "vitest";
import { componentSignals, normalizeWeights, rankProspects, scoreProspect, type RankingContext } from "./ranking";
import { DEFAULT_RANKING_WEIGHTS, type Prospect, type RankingWeights } from "./crmTypes";

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Test Logistics",
    contactName: null,
    contactRole: null,
    contactPhone: null,
    contactWhatsapp: null,
    contactEmail: null,
    location: null,
    estimatedFleetSizeRaw: null,
    primaryPainRaw: null,
    phoneClassification: null,
    source: "outbound-cold-list",
    stage: 1,
    lastInteractionOutcome: null,
    lastInteractionSummary: null,
    lastContactDate: null,
    nextActionDate: null,
    nextActionType: null,
    nextActionNote: null,
    priorityScore: null,
    intelligence: {},
    linkedLeadId: null,
    linkedVisitorId: null,
    visitorSnapshot: null,
    campaignId: null,
    icpFitScore: null,
    opportunityScore: null,
    riskFlags: [],
    flags: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    whatsappStatus: "unknown",
    whatsappVerifiedAt: null,
    whatsappJid: null,
    whatsappOptedOut: false,
    ...overrides,
  };
}

const ctx: RankingContext = { today: "2026-08-12", strategicTerms: [] };

describe("normalizeWeights", () => {
  it("normalizes percentages to fractions summing to 1", () => {
    const n = normalizeWeights(DEFAULT_RANKING_WEIGHTS);
    const sum = Object.values(n).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    // icpFit is the heaviest at 25/100.
    expect(n.icpFit).toBeCloseTo(0.25, 6);
  });

  it("falls back to an even split when all weights are zero", () => {
    const zero = Object.fromEntries(Object.keys(DEFAULT_RANKING_WEIGHTS).map((k) => [k, 0])) as RankingWeights;
    const n = normalizeWeights(zero);
    expect(n.icpFit).toBeCloseTo(1 / 7, 6);
  });
});

describe("componentSignals", () => {
  it("derives icpFit, engagement, and buyingIntent from their 0-100 fields", () => {
    const p = makeProspect({ icpFitScore: 80, opportunityScore: 60, visitorSnapshot: { visitorId: "v", engagementScore: 50, intentScore: 40, totalSessions: 2, totalPageViews: 5, topPages: [], lastSeenAt: "2026-08-10T00:00:00.000Z", firstLandingPage: null, lastReferrerType: "organic" } });
    const s = componentSignals(p, ctx);
    expect(s.icpFit).toBeCloseTo(0.8, 6);
    expect(s.buyingIntent).toBeCloseTo(0.6, 6);
    expect(s.engagement).toBeCloseTo(0.5, 6);
  });

  it("scales follow-up urgency by days overdue, saturating at 14 days", () => {
    expect(componentSignals(makeProspect({ nextActionDate: "2026-08-05" }), ctx).followUpUrgency).toBeCloseTo(7 / 14, 6);
    expect(componentSignals(makeProspect({ nextActionDate: "2026-07-01" }), ctx).followUpUrgency).toBe(1);
    expect(componentSignals(makeProspect({ nextActionDate: "2026-08-12" }), ctx).followUpUrgency).toBe(0.5);
    expect(componentSignals(makeProspect({ nextActionDate: "2026-08-20" }), ctx).followUpUrgency).toBe(0);
  });

  it("lets an urgent WhatsApp override a not-yet-due follow-up", () => {
    const p = makeProspect({ id: "wa1", nextActionDate: "2026-08-20" });
    const withWa: RankingContext = { ...ctx, whatsappUrgencyByProspect: { wa1: "urgent" } };
    expect(componentSignals(p, withWa).followUpUrgency).toBe(1);
  });

  it("matches strategic terms against the prospect's ICP text (case-insensitive)", () => {
    const p = makeProspect({ location: "Copperbelt", primaryPainRaw: "Manual dispatching across depots" });
    expect(componentSignals(p, { ...ctx, strategicTerms: ["copperbelt"] }).strategicRelevance).toBe(1);
    expect(componentSignals(p, { ...ctx, strategicTerms: ["dispatching"] }).strategicRelevance).toBe(1);
    expect(componentSignals(p, { ...ctx, strategicTerms: ["mining"] }).strategicRelevance).toBe(0);
    // Terms under 3 chars are ignored to avoid noise matches.
    expect(componentSignals(p, { ...ctx, strategicTerms: ["co"] }).strategicRelevance).toBe(0);
  });

  it("weights contactability toward a verified WhatsApp", () => {
    expect(componentSignals(makeProspect({ contactPhone: "0977000000" }), ctx).contactability).toBeCloseTo(0.4, 6);
    expect(componentSignals(makeProspect({ contactPhone: "0977000000", contactEmail: "a@b.com", whatsappStatus: "verified" }), ctx).contactability).toBe(1);
    // An opted-out prospect gets no WhatsApp credit even if verified.
    expect(componentSignals(makeProspect({ whatsappStatus: "verified", whatsappOptedOut: true }), ctx).contactability).toBe(0);
  });

  it("treats never-contacted prospects as having ~zero recency momentum", () => {
    expect(componentSignals(makeProspect({ lastContactDate: null }), ctx).recency).toBeLessThan(0.01);
    expect(componentSignals(makeProspect({ lastContactDate: "2026-08-12" }), ctx).recency).toBe(1);
  });
});

describe("scoreProspect", () => {
  it("produces a 0-100 score whose breakdown contributions sum to it", () => {
    const p = makeProspect({ icpFitScore: 90, opportunityScore: 70, contactPhone: "0977000000", nextActionDate: "2026-08-01" });
    const rank = scoreProspect(p, DEFAULT_RANKING_WEIGHTS, ctx);
    expect(rank.score).toBeGreaterThan(0);
    expect(rank.score).toBeLessThanOrEqual(100);
    const sum = rank.breakdown.reduce((s, b) => s + b.contribution, 0);
    expect(sum).toBeCloseTo(rank.score, 1);
    expect(rank.aiAdjusted).toBe(false);
  });

  it("surfaces the top contributing components as human reasons", () => {
    const p = makeProspect({ icpFitScore: 95, opportunityScore: 90, nextActionDate: "2026-07-01" });
    const rank = scoreProspect(p, DEFAULT_RANKING_WEIGHTS, ctx);
    expect(rank.reasons).toContain("Strong ICP fit");
    expect(rank.reasons).toContain("High buying intent");
    expect(rank.reasons.length).toBeLessThanOrEqual(3);
  });

  it("an all-null prospect scores 0 with no reasons", () => {
    const rank = scoreProspect(makeProspect(), DEFAULT_RANKING_WEIGHTS, ctx);
    expect(rank.score).toBe(0);
    expect(rank.reasons).toEqual([]);
  });
});

describe("rankProspects", () => {
  it("orders a strong prospect above a weak one", () => {
    const strong = makeProspect({ id: "strong", icpFitScore: 95, opportunityScore: 85, contactPhone: "0977", nextActionDate: "2026-07-15" });
    const weak = makeProspect({ id: "weak", icpFitScore: 10, opportunityScore: 5 });
    const ranked = rankProspects([weak, strong], DEFAULT_RANKING_WEIGHTS, ctx);
    expect(ranked[0].id).toBe("strong");
    expect(ranked[1].id).toBe("weak");
  });

  it("breaks score ties by the older next-action date first", () => {
    const a = makeProspect({ id: "a", nextActionDate: "2026-08-10" });
    const b = makeProspect({ id: "b", nextActionDate: "2026-08-02" });
    const ranked = rankProspects([a, b], DEFAULT_RANKING_WEIGHTS, ctx);
    // Identical fields ⇒ identical score ⇒ older next-action (b) leads.
    expect(ranked[0].id).toBe("b");
  });
});
