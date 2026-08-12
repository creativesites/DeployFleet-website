import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getStore } from "@/lib/adminStore";
import { getBriefingStatus, listInboxEntries, listWhatsAppConversations } from "@/lib/crm";
import { completeWithFallback } from "@/lib/ai/router";
import { DAILY_SYNTHESIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { InboxEntry } from "@/lib/crmTypes";

/**
 * Revenue OS RS-2 §5.6 — the Daily AI Synthesis roll-up. Aggregates today's
 * inbox extractions + briefing completeness + WhatsApp activity into a
 * deterministic digest, then adds an AI narrative on top when a provider is
 * configured. Cached for the day (getStore/TTL, like SystemState); ?refresh=1
 * bypasses. Always returns a deterministic fallbackText, so the UI shows a
 * real summary even with AI off (§6).
 */

interface Synthesis {
  date: string;
  narrative: string | null;
  fallbackText: string;
  aiUsed: boolean;
  counts: {
    entries: number;
    facts: number;
    tasks: number;
    decisions: number;
    risks: number;
    recommendations: number;
    competitors: number;
    decisionMakers: number;
    unansweredQuestions: number;
    timelineSignals: number;
    budgetSignals: number;
  };
  briefings: { submitted: number; total: number; completenessPct: number };
  whatsappAwaiting: number;
  generatedAt: string;
}

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}
function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `DAILY_SYNTHESIS:${today}`;
  const store = getStore();
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await store.get<Synthesis>(cacheKey);
    if (cached) return NextResponse.json({ ok: true, synthesis: cached, cached: true });
  }

  const startOfToday = `${today}T00:00:00.000Z`;
  const [entriesAll, briefingReport, awaitingWhatsApp] = await Promise.all([
    listInboxEntries({ limit: 500 }),
    getBriefingStatus(),
    listWhatsAppConversations({ requiresResponse: true }),
  ]);

  const entries = entriesAll.filter((e: InboxEntry) => e.createdAt >= startOfToday && e.extractionResult);

  const facts: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];
  const competitors: string[] = [];
  const decisionMakers: string[] = [];
  const unansweredQuestions: string[] = [];
  const timelines: string[] = [];
  const budgets: string[] = [];
  let taskCount = 0;
  let decisionCount = 0;

  for (const e of entries) {
    const r = e.extractionResult!;
    for (const f of r.facts) facts.push(`${f.key}: ${f.value}`);
    taskCount += r.tasks.length;
    decisionCount += r.decisions.length;
    risks.push(...r.risks);
    recommendations.push(...r.recommendations);
    competitors.push(...r.competitors);
    decisionMakers.push(...r.decisionMakers);
    unansweredQuestions.push(...r.unansweredQuestions);
    if (r.timeline) timelines.push(r.timeline);
    if (r.budget) budgets.push(r.budget);
  }

  const counts: Synthesis["counts"] = {
    entries: entries.length,
    facts: facts.length,
    tasks: taskCount,
    decisions: decisionCount,
    risks: risks.length,
    recommendations: recommendations.length,
    competitors: dedupe(competitors).length,
    decisionMakers: dedupe(decisionMakers).length,
    unansweredQuestions: unansweredQuestions.length,
    timelineSignals: timelines.length,
    budgetSignals: budgets.length,
  };

  // Deterministic fallback sentence — the counts that actually moved.
  const parts: string[] = [];
  parts.push(`${briefingReport.submittedCount}/${briefingReport.totalCount} briefings in (${briefingReport.completenessPct}%)`);
  if (counts.facts) parts.push(`${counts.facts} new fact${counts.facts === 1 ? "" : "s"}`);
  if (counts.risks) parts.push(`${counts.risks} risk${counts.risks === 1 ? "" : "s"}`);
  if (counts.recommendations) parts.push(`${counts.recommendations} recommendation${counts.recommendations === 1 ? "" : "s"}`);
  if (counts.competitors) parts.push(`${counts.competitors} competitor${counts.competitors === 1 ? "" : "s"} named`);
  if (counts.decisionMakers) parts.push(`${counts.decisionMakers} decision-maker${counts.decisionMakers === 1 ? "" : "s"} identified`);
  if (awaitingWhatsApp.length) parts.push(`${awaitingWhatsApp.length} WhatsApp awaiting a reply`);
  const fallbackText =
    entries.length === 0 && awaitingWhatsApp.length === 0
      ? `No new intelligence submitted yet today. ${briefingReport.totalCount - briefingReport.submittedCount} briefing(s) still outstanding.`
      : `Today: ${parts.join(", ")}.`;

  // AI narrative on top, when available.
  let narrative: string | null = null;
  let aiUsed = false;
  if (process.env.AI_FEATURES_ENABLED !== "false" && (entries.length > 0 || awaitingWhatsApp.length > 0)) {
    const digestLines = [
      `Date: ${today}`,
      `Briefings submitted: ${briefingReport.submittedCount}/${briefingReport.totalCount} (${briefingReport.completenessPct}%).`,
      briefingReport.items.filter((i) => !i.submitted).length
        ? `Outstanding briefings: ${briefingReport.items.filter((i) => !i.submitted).map((i) => `${i.employeeName} (${i.cadence})`).join(", ")}.`
        : `All required briefings are in.`,
      `WhatsApp conversations awaiting a reply: ${awaitingWhatsApp.length}.`,
      facts.length ? `Facts (${facts.length}):\n${cap(dedupe(facts), 15).map((f) => `- ${f}`).join("\n")}` : null,
      risks.length ? `Risks (${risks.length}):\n${cap(dedupe(risks), 10).map((r) => `- ${r}`).join("\n")}` : null,
      recommendations.length ? `Recommendations (${recommendations.length}):\n${cap(dedupe(recommendations), 10).map((r) => `- ${r}`).join("\n")}` : null,
      competitors.length ? `Competitors / current tools: ${cap(dedupe(competitors), 12).join(", ")}` : null,
      decisionMakers.length ? `Decision-makers: ${cap(dedupe(decisionMakers), 12).join(", ")}` : null,
      unansweredQuestions.length ? `Open questions:\n${cap(dedupe(unansweredQuestions), 10).map((q) => `- ${q}`).join("\n")}` : null,
      timelines.length ? `Timeline signals: ${cap(dedupe(timelines), 8).join("; ")}` : null,
      budgets.length ? `Budget signals: ${cap(dedupe(budgets), 8).join("; ")}` : null,
    ].filter((l): l is string => l !== null);

    const result = await completeWithFallback({
      systemPrompt: DAILY_SYNTHESIS_SYSTEM_PROMPT,
      userPrompt: digestLines.join("\n"),
      maxOutputTokens: 400,
      temperature: 0.4,
    });
    if (result.ok && result.text.trim()) {
      narrative = result.text.trim();
      aiUsed = true;
    }
  }

  const synthesis: Synthesis = {
    date: today,
    narrative,
    fallbackText,
    aiUsed,
    counts,
    briefings: { submitted: briefingReport.submittedCount, total: briefingReport.totalCount, completenessPct: briefingReport.completenessPct },
    whatsappAwaiting: awaitingWhatsApp.length,
    generatedAt: new Date().toISOString(),
  };

  // Cache until the next UTC midnight so it refreshes with the new day.
  const now = new Date();
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ttl = Math.max(60, Math.floor((nextMidnight - now.getTime()) / 1000));
  await store.set(cacheKey, synthesis, ttl);

  return NextResponse.json({ ok: true, synthesis, cached: false });
}
