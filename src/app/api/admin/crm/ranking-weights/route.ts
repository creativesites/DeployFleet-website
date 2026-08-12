import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { getRankingWeights, saveRankingWeights } from "@/lib/goals";
import { getStore } from "@/lib/adminStore";
import { RANKING_COMPONENT_META, type RankingWeights } from "@/lib/crmTypes";

/** Revenue OS RS-1 §5.7 — the editable Daily Prospect Engine weights. Admin-gated read + write, persistence-aware like the goals editor. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const weights = await getRankingWeights();
  return NextResponse.json({ ok: true, weights, persistent: getStore().persistent });
}

function coerceWeights(raw: unknown): RankingWeights | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const out = {} as RankingWeights;
  for (const { key } of RANKING_COMPONENT_META) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return null;
    out[key] = Math.round(value);
  }
  // Guard against an all-zero config that would make every prospect score 0.
  if (RANKING_COMPONENT_META.every(({ key }) => out[key] === 0)) return null;
  return out;
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const weights = coerceWeights((body as { weights?: unknown })?.weights ?? body);
  if (!weights) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const saved = await saveRankingWeights(weights);
  return NextResponse.json({ ok: true, weights: saved, persistent: getStore().persistent });
}
