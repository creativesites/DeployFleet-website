import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listCampaigns, listDirectives, listProspects, listWhatsAppConversations } from "@/lib/crm";
import { getRankingWeights } from "@/lib/goals";
import { rankProspects, type RankingContext, type WhatsAppUrgency } from "@/lib/ranking";
import { completeWithFallback } from "@/lib/ai/router";
import { PROSPECT_RERANK_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";
import type { RankedProspect } from "@/lib/crmTypes";

/**
 * Revenue OS RS-1 §5.7 — the Daily Prospect Engine's endpoint. Replaces
 * Today's plain dueBy-sorted-by-date list with a deterministic weighted
 * ranking over the same candidate set (due today or overdue). An optional
 * AI re-rank of the top candidates runs on top when a provider is
 * configured, but the deterministic order is always what ships if AI is
 * off, disabled, or returns anything malformed (§6).
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "our", "that", "this", "from", "into", "over", "week", "weekly", "company", "companies",
  "objective", "primary", "focus", "drive", "toward", "target", "targets", "prospect", "prospects", "deployfleet",
]);

/** Tokenize directive/campaign text into substring-matchable strategic terms. */
function strategicTermsFrom(texts: string[]): string[] {
  const terms = new Set<string>();
  for (const text of texts) {
    for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length >= 4 && !STOPWORDS.has(word)) terms.add(word);
    }
  }
  return [...terms];
}

const URGENCY_RANK: Record<WhatsAppUrgency, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

async function aiRerank(top: RankedProspect[]): Promise<{ order: string[]; topReason: string | null } | null> {
  if (process.env.AI_FEATURES_ENABLED === "false") return null;
  const lines = top.map((p, i) => {
    const blurb = [
      p.intelligence.likelyPain?.value ?? p.primaryPainRaw,
      p.nextActionNote,
      p.lastInteractionSummary,
      p.rank.reasons.length ? `signals: ${p.rank.reasons.join(", ")}` : null,
    ]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" — ")
      .slice(0, 240);
    return `${i + 1}. id=${p.id} | ${p.name} | score ${p.rank.score} | ${blurb || "no notes yet"}`;
  });
  const result = await completeWithFallback({
    systemPrompt: PROSPECT_RERANK_SYSTEM_PROMPT,
    userPrompt: `Candidates (already in deterministic order):\n${lines.join("\n")}`,
    maxOutputTokens: 400,
    temperature: 0.2,
  });
  if (!result.ok) return null;
  const parsed = parseJsonLoosely<{ order?: unknown; topReason?: unknown }>(result.text);
  if (!parsed || !Array.isArray(parsed.order)) return null;
  const order = parsed.order.filter((x): x is string => typeof x === "string");
  // Must be a permutation of exactly the ids we sent — else discard entirely.
  const sentIds = new Set(top.map((p) => p.id));
  if (order.length !== top.length || new Set(order).size !== top.length || !order.every((id) => sentIds.has(id))) {
    return null;
  }
  return { order, topReason: typeof parsed.topReason === "string" ? parsed.topReason : null };
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const aiRequested = request.nextUrl.searchParams.get("ai") !== "0";

  const [prospects, weights, directives, campaigns, awaitingWhatsApp] = await Promise.all([
    listProspects({ dueBy: today }),
    getRankingWeights(),
    listDirectives({ status: "active" }),
    listCampaigns(),
    listWhatsAppConversations({ requiresResponse: true }),
  ]);

  const strategicTerms = strategicTermsFrom([
    ...directives.map((d) => `${d.title} ${d.body}`),
    ...campaigns.filter((c) => c.status === "active").map((c) => c.name),
  ]);

  // Highest WhatsApp urgency per prospect awaiting a reply.
  const whatsappUrgencyByProspect: Record<string, WhatsAppUrgency> = {};
  for (const convo of awaitingWhatsApp) {
    const urgency = convo.responseUrgency;
    if (!urgency) continue;
    const existing = whatsappUrgencyByProspect[convo.prospectId];
    if (!existing || URGENCY_RANK[urgency] > URGENCY_RANK[existing]) {
      whatsappUrgencyByProspect[convo.prospectId] = urgency;
    }
  }

  const ctx: RankingContext = { today, strategicTerms, whatsappUrgencyByProspect };
  let ranked = rankProspects(prospects, weights, ctx);

  // Optional AI re-rank of the top slice (§5.7 "re-rank the top ~15 → 10").
  let aiReranked = false;
  if (aiRequested && ranked.length > 1) {
    const sliceSize = Math.min(15, ranked.length);
    const top = ranked.slice(0, sliceSize);
    const rerank = await aiRerank(top);
    if (rerank) {
      const byId = new Map(top.map((p) => [p.id, p]));
      const reordered = rerank.order.map((id, newIndex) => {
        const p = byId.get(id)!;
        const movedFrom = top.findIndex((t) => t.id === id);
        const aiAdjusted = movedFrom !== newIndex;
        const reasons = newIndex === 0 && rerank.topReason ? [rerank.topReason, ...p.rank.reasons].slice(0, 3) : p.rank.reasons;
        return { ...p, rank: { ...p.rank, aiAdjusted, reasons } };
      });
      ranked = [...reordered, ...ranked.slice(sliceSize)];
      aiReranked = true;
    }
  }

  return NextResponse.json({ ok: true, prospects: ranked, aiReranked, generatedAt: new Date().toISOString() });
}
