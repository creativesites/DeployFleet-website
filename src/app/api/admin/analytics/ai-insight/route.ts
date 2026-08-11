import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { completeWithFallback } from "@/lib/ai/router";
import { MARKETING_INSIGHT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getCampaignPerformance, getContentPerformance, getFunnelSummary, getGeographyBreakdown } from "@/lib/visitorIntelligence";

/**
 * Spec §36 — manual trigger only (a POST the Insights page's button
 * calls), never auto-fetched, same deliberate AI-spend discipline as
 * every calculator's "Get AI Insight" button. Builds a compact,
 * already-aggregated summary — no visitor ids, names, emails, phones, or
 * anything else identifying — and hands it to the same DeepSeek/Gemini
 * router every other AI feature on this site already goes through.
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  const [funnel, campaigns, content, geography] = await Promise.all([
    getFunnelSummary(),
    getCampaignPerformance(),
    getContentPerformance(),
    getGeographyBreakdown(null),
  ]);

  const summary = [
    `Funnel: ${funnel.totalVisitors} total visitors, ${funnel.visitorsWithSession} with a session, ${funnel.engagedVisitors} engaged, ${funnel.convertedVisitors} converted, ${funnel.identifiedVisitors} became leads.`,
    "Top channels by sessions: " +
      campaigns
        .slice(0, 5)
        .map((c) => `${c.channel} (${c.sessions} sessions, ${c.conversions} conversions)`)
        .join("; ") || "no channel data yet.",
    "Top pages by views: " +
      content
        .slice(0, 5)
        .map((c) => `${c.pagePath} (${c.views} views, ${c.conversions} conversions)`)
        .join("; ") || "no page data yet.",
    "Top countries by visitors: " +
      geography
        .slice(0, 5)
        .map((g) => `${g.country} (${g.visitorCount} visitors, ${g.demoRequestCount} demo/contact requests)`)
        .join("; ") || "no geography data yet.",
  ].join("\n");

  const result = await completeWithFallback({
    systemPrompt: MARKETING_INSIGHT_SYSTEM_PROMPT,
    userPrompt: summary,
  });

  return NextResponse.json(result);
}
