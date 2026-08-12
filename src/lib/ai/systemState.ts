import "server-only";
import { getStore } from "@/lib/adminStore";
import { getCampaignScoreboard, getWeeklyScoreboard, listCampaigns, listProspects, listWhatsAppConversations } from "@/lib/crm";

/**
 * Phase 2 §8.3 — a single, always-current summary the Orchestrator and
 * Command Center read instead of re-querying five collections per call.
 * Not a new Firestore collection — a computed document, cached via the
 * same KeyValueStore (Upstash Redis when configured) as everything else
 * in this AI system.
 *
 * One deliberate deviation from the doc's literal wording, disclosed
 * here: §8.3 says this should be "rebuilt on the same triggers as
 * GLOBAL_CONTEXT" (event-driven invalidation). This implementation uses
 * a flat 15-minute TTL instead — computing it touches prospects,
 * campaigns, and the weekly scoreboard all at once, so wiring surgical
 * invalidation into every one of those write paths (on top of the
 * Context Compiler's own invalidation, §7.6) would be real additional
 * complexity for a summary that's read, not acted on precisely — a
 * 15-minute staleness window is an acceptable tradeoff here. Worth
 * revisiting if the Command Center starts feeling stale in practice.
 */

const SYSTEM_STATE_KEY = "SYSTEM_STATE";
const SYSTEM_STATE_TTL_SECONDS = 15 * 60;

export interface SystemState {
  computedAt: string;
  currentCampaign: { id: string; name: string; attempts: number; meaningful: number } | null;
  todayAttempts: number;
  todayMeaningful: number;
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
  overdueProspectCount: number;
  biggestBottleneck: string | null;
  topProspect: { id: string; name: string; opportunityScore: number } | null;
  topRisk: { flag: string; count: number } | null;
  /** docs/whatsapp-intelligence-architecture.md §12 — Command Center's WhatsApp tile + Daily Rhythm's brief content. */
  whatsappAwaitingResponseCount: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mostRecentMondayIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

async function computeSystemState(): Promise<SystemState> {
  const [campaigns, prospects, weekly, awaitingWhatsApp] = await Promise.all([
    listCampaigns(),
    listProspects({ includeArchived: false }),
    getWeeklyScoreboard(mostRecentMondayIso()),
    listWhatsAppConversations({ requiresResponse: true }),
  ]);

  const activeCampaign = campaigns.find((c) => c.status === "active") ?? null;
  let currentCampaign: SystemState["currentCampaign"] = null;
  if (activeCampaign) {
    const scoreboard = await getCampaignScoreboard(activeCampaign.id);
    if (scoreboard) {
      currentCampaign = { id: activeCampaign.id, name: activeCampaign.name, attempts: scoreboard.attempts, meaningful: scoreboard.meaningful };
    }
  }

  const today = todayIso();
  const todayEntry = weekly.days.find((d) => d.date === today);
  const todayAttempts = todayEntry?.attempts ?? 0;
  const todayMeaningful = todayEntry?.meaningful ?? 0;

  const overdueProspects = prospects.filter((p) => p.nextActionDate !== null && p.nextActionDate < today);

  // §12 — Winston's own morning-brief example, as one more `if` branch:
  // a verified-WhatsApp, high-opportunity prospect nobody has messaged yet.
  const readyWhatsAppProspect = prospects
    .filter((p) => p.whatsappStatus === "verified" && !p.whatsappOptedOut && (p.opportunityScore ?? 0) >= 60)
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))[0];

  let biggestBottleneck: string | null = null;
  if (todayAttempts < weekly.targetAttemptsPerDay / 2) {
    biggestBottleneck = `Only ${todayAttempts}/${weekly.targetAttemptsPerDay} outbound attempts logged today — pace is behind.`;
  } else if (overdueProspects.length > 0) {
    biggestBottleneck = `${overdueProspects.length} prospect${overdueProspects.length === 1 ? "" : "s"} have an overdue next action.`;
  } else if (awaitingWhatsApp.length > 0) {
    biggestBottleneck = `${awaitingWhatsApp.length} WhatsApp conversation${awaitingWhatsApp.length === 1 ? "" : "s"} awaiting a response.`;
  } else if (readyWhatsAppProspect) {
    biggestBottleneck = `${readyWhatsAppProspect.name} is WhatsApp-verified with a high opportunity score — no outreach made yet.`;
  }

  const topProspect = prospects
    .filter((p): p is typeof p & { opportunityScore: number } => p.opportunityScore !== null)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)[0];

  const riskCounts = new Map<string, number>();
  for (const p of prospects) {
    for (const flag of p.riskFlags) riskCounts.set(flag, (riskCounts.get(flag) ?? 0) + 1);
  }
  let topRisk: SystemState["topRisk"] = null;
  for (const [flag, count] of riskCounts) {
    if (!topRisk || count > topRisk.count) topRisk = { flag, count };
  }

  return {
    computedAt: new Date().toISOString(),
    currentCampaign,
    todayAttempts,
    todayMeaningful,
    targetAttemptsPerDay: weekly.targetAttemptsPerDay,
    targetMeaningfulPerDay: weekly.targetMeaningfulPerDay,
    overdueProspectCount: overdueProspects.length,
    biggestBottleneck,
    topProspect: topProspect ? { id: topProspect.id, name: topProspect.name, opportunityScore: topProspect.opportunityScore } : null,
    topRisk,
    whatsappAwaitingResponseCount: awaitingWhatsApp.length,
  };
}

export async function getSystemState(): Promise<SystemState> {
  const store = getStore();
  const cached = await store.get<SystemState>(SYSTEM_STATE_KEY);
  if (cached) return cached;
  const state = await computeSystemState();
  await store.set(SYSTEM_STATE_KEY, state, SYSTEM_STATE_TTL_SECONDS);
  return state;
}

export async function invalidateSystemState(): Promise<void> {
  await getStore().delete(SYSTEM_STATE_KEY);
}

export function formatSystemState(state: SystemState): string {
  const lines = [
    state.currentCampaign
      ? `Current campaign: "${state.currentCampaign.name}" — ${state.currentCampaign.attempts} attempts, ${state.currentCampaign.meaningful} meaningful interactions so far.`
      : "No active campaign.",
    `Today: ${state.todayAttempts}/${state.targetAttemptsPerDay} attempts, ${state.todayMeaningful}/${state.targetMeaningfulPerDay} meaningful interactions.`,
    `${state.overdueProspectCount} prospect(s) overdue on their next action.`,
    state.whatsappAwaitingResponseCount > 0
      ? `${state.whatsappAwaitingResponseCount} WhatsApp conversation(s) awaiting a response.`
      : null,
    state.biggestBottleneck ? `Biggest bottleneck: ${state.biggestBottleneck}` : "No major bottleneck flagged right now.",
    state.topProspect ? `Top prospect by opportunity: ${state.topProspect.name} (score ${state.topProspect.opportunityScore}).` : null,
    state.topRisk ? `Most common risk flag: "${state.topRisk.flag}" (${state.topRisk.count} prospects).` : null,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
