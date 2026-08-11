import "server-only";
import { createAuditEvent, listAllFacts, listDecisions, listProspects, markFactStatus } from "../crm";
import { PIPELINE_STAGE_LABEL } from "../crmTypes";

/**
 * Phase 1 §7.5 — the Reality & Reconciliation Engine. A callable
 * function, not a background job (Vercel Cron is deliberately deferred —
 * see the architecture doc §12), triggered manually from a button on
 * /admin/insights. Every check here is deterministic, no AI call — same
 * "don't use AI for basic arithmetic" precedent as Visitor Intelligence's
 * own getAlerts().
 */

const STALE_NEXT_ACTION_DAYS = 3;
const STALLED_FACT_DAYS = 30;

export type ReconciliationFlagType =
  | "stale_next_action"
  | "stalled_fact"
  | "contradiction"
  | "orphaned_decision"
  | "missing_required_info";

export interface ReconciliationFlag {
  type: ReconciliationFlagType;
  prospectId: string | null;
  summary: string;
}

export interface ReconciliationResult {
  flags: ReconciliationFlag[];
  checkedAt: string;
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  const now = new Date();
  const flags: ReconciliationFlag[] = [];

  const [prospects, allFacts, activeDecisions] = await Promise.all([
    listProspects({ includeArchived: true }),
    listAllFacts(),
    listDecisions({ status: "active" }),
  ]);
  const prospectById = new Map(prospects.map((p) => [p.id, p]));

  // 1. Stale next actions — nextActionDate N+ days in the past with no contact since it was set.
  const staleThresholdIso = new Date(now.getTime() - STALE_NEXT_ACTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const p of prospects) {
    if (p.archivedAt || !p.nextActionDate) continue;
    if (p.nextActionDate >= staleThresholdIso) continue;
    const contactedSince = p.lastContactDate !== null && p.lastContactDate >= p.nextActionDate;
    if (contactedSince) continue;
    flags.push({
      type: "stale_next_action",
      prospectId: p.id,
      summary: `${p.name}'s next action (${p.nextActionDate}) is overdue by ${STALE_NEXT_ACTION_DAYS}+ days with no contact logged since.`,
    });
  }

  // 2. Stalled facts — active, not rechecked in STALLED_FACT_DAYS. Also marks them reconciliation_required.
  const stalledThreshold = new Date(now.getTime() - STALLED_FACT_DAYS * 24 * 60 * 60 * 1000);
  for (const f of allFacts) {
    if (f.status !== "active") continue;
    if (new Date(f.lastCheckedAt) >= stalledThreshold) continue;
    await markFactStatus(f.id, "reconciliation_required");
    const prospect = prospectById.get(f.prospectId);
    flags.push({
      type: "stalled_fact",
      prospectId: f.prospectId,
      summary: `Fact "${f.key}" for ${prospect?.name ?? "an unknown prospect"} hasn't been rechecked in ${STALLED_FACT_DAYS}+ days.`,
    });
  }

  // 3. Contradictions — safety net for anything that slipped past the Inbox's own contradiction detection (§7.1).
  const byProspectKey = new Map<string, typeof allFacts>();
  for (const f of allFacts) {
    if (f.status !== "active" && f.status !== "reconciliation_required") continue;
    const mapKey = `${f.prospectId}::${f.key}`;
    const group = byProspectKey.get(mapKey);
    if (group) group.push(f);
    else byProspectKey.set(mapKey, [f]);
  }
  for (const group of byProspectKey.values()) {
    if (group.length < 2) continue;
    const distinctValues = new Set(group.map((f) => f.value));
    if (distinctValues.size < 2) continue;
    const prospect = prospectById.get(group[0].prospectId);
    flags.push({
      type: "contradiction",
      prospectId: group[0].prospectId,
      summary: `Conflicting values for "${group[0].key}" on ${prospect?.name ?? "an unknown prospect"}: ${Array.from(distinctValues).join(" vs. ")}.`,
    });
  }

  // 4. Orphaned decisions — prospect-scoped, prospect since archived or gone. (Campaign-scoped decisions aren't modeled yet — DecisionScope has no campaign variant.)
  for (const d of activeDecisions) {
    if (d.scope.type !== "prospect") continue;
    const prospect = prospectById.get(d.scope.prospectId);
    if (prospect && !prospect.archivedAt) continue;
    flags.push({
      type: "orphaned_decision",
      prospectId: d.scope.prospectId,
      summary: `Decision "${d.decisionText}" references a prospect that's since been archived or no longer exists.`,
    });
  }

  // 5. Missing required info — past "Contact Attempted" with no decision-maker name.
  for (const p of prospects) {
    if (p.archivedAt || p.stage <= 2 || p.contactName) continue;
    flags.push({
      type: "missing_required_info",
      prospectId: p.id,
      summary: `${p.name} is at "${PIPELINE_STAGE_LABEL[p.stage]}" with no decision-maker contact name recorded.`,
    });
  }

  for (const flag of flags) {
    await createAuditEvent({
      eventType: "reconciliation_flag_raised",
      summary: flag.summary,
      relatedProspectId: flag.prospectId,
      actor: "ai_reconciliation",
      metadata: { flagType: flag.type },
    });
  }

  return { flags, checkedAt: now.toISOString() };
}
