import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { applyIntelligence, getProspect } from "@/lib/crm";
import { completeWithFallback } from "@/lib/ai/router";
import { SDR_BRIEF_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";
import type { ProspectIntelligence } from "@/lib/crmTypes";

interface RawBrief {
  fleetTier?: string;
  likelyPain?: string;
  recommendedWedge?: string;
  recommendedChannel?: string;
  discoveryQuestion?: string;
  summary?: string;
  priorityScore?: number;
}

/** Brief #4 — "Prepare Me": generates a structured SDR brief for one prospect and folds it into their intelligence map. Manual, per-prospect trigger, not batch-generated for all 52 at once (same AI-spend discipline as every other AI feature in this project). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const facts = [
    `Company: ${prospect.name}`,
    prospect.location ? `Location: ${prospect.location}` : null,
    prospect.estimatedFleetSizeRaw ? `Estimated fleet size: ${prospect.estimatedFleetSizeRaw}` : null,
    prospect.primaryPainRaw ? `Likely pain (from source list): ${prospect.primaryPainRaw}` : null,
    prospect.nextActionNote ? `Notes: ${prospect.nextActionNote}` : null,
    prospect.visitorSnapshot
      ? `Website activity: ${prospect.visitorSnapshot.totalSessions} sessions, ${prospect.visitorSnapshot.totalPageViews} page views, engagement score ${prospect.visitorSnapshot.engagementScore}/100, intent score ${prospect.visitorSnapshot.intentScore}/100, top pages: ${prospect.visitorSnapshot.topPages.join(", ") || "none recorded"}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await completeWithFallback({ systemPrompt: SDR_BRIEF_SYSTEM_PROMPT, userPrompt: facts });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  const raw = parseJsonLoosely<RawBrief>(result.text);
  if (!raw) {
    return NextResponse.json({ ok: false, reason: "invalid_ai_response" });
  }

  const generatedAt = new Date().toISOString();
  const field = <T,>(value: T | undefined) =>
    value === undefined || value === null
      ? undefined
      : { value, source: "AI SDR brief", sourceType: "ai_research" as const, confidence: null, verified: false, generatedAt };

  const intelligence: Partial<ProspectIntelligence> = {
    fleetTier: field(raw.fleetTier),
    likelyPain: field(raw.likelyPain),
    recommendedWedge: field(raw.recommendedWedge),
    recommendedChannel: field(raw.recommendedChannel),
    discoveryQuestion: field(raw.discoveryQuestion),
    summary: field(raw.summary),
    priorityScore: typeof raw.priorityScore === "number" ? field(raw.priorityScore) : undefined,
  };

  // Strip undefined keys so applyIntelligence()'s Object.entries() loop only writes fields the model actually returned.
  const cleaned = Object.fromEntries(Object.entries(intelligence).filter(([, v]) => v !== undefined)) as Partial<ProspectIntelligence>;

  await applyIntelligence(id, cleaned);

  return NextResponse.json({ ok: true, intelligence: cleaned });
}
