import { NextResponse, type NextRequest } from "next/server";
import { completeWithFallback } from "@/lib/ai/router";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import { getCached, setCached } from "@/lib/ai/cache";
import { CALCULATOR_INSIGHT_SYSTEM_PROMPT, MAX_USER_PROMPT_LENGTH } from "@/lib/ai/prompts";

/**
 * The one Layer 2 entry point every calculator's AI Insight panel calls.
 * Policy check → rate limit → cache → provider router, in that order —
 * matching the flow diagrammed in the Intelligence Hub plan §03. Never
 * throws; always returns a 200 with an { ok: boolean } body so the client
 * can render a graceful-degradation state instead of a fetch error.
 */

interface RequestBody {
  feature?: string;
  prompt?: string;
}

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const feature = typeof body.feature === "string" ? body.feature.slice(0, 100) : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  if (!feature || !prompt || prompt.length > MAX_USER_PROMPT_LENGTH) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const rateLimitKey = `${clientIp(request)}:${feature}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, reason: "rate_limited" });
  }

  const cacheKey = `${feature}:${prompt}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const result = await completeWithFallback({
    systemPrompt: CALCULATOR_INSIGHT_SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  setCached(cacheKey, result);

  return NextResponse.json(result);
}
