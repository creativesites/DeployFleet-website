import "server-only";
import { getStore } from "@/lib/adminStore";
import {
  getAiEmployee,
  getProspect,
  listDecisions,
  listFacts,
  listInboxEntries,
  listInteractions,
  listTasks,
} from "@/lib/crm";
import { PIPELINE_STAGE_LABEL, INTERACTION_TYPE_LABEL } from "@/lib/crmTypes";
import { CONTEXT_TTL_SECONDS, GLOBAL_CONTEXT_KEY, employeeContextKey, prospectContextKey } from "./contextCache";

export { invalidateEmployeeContext, invalidateGlobalContext, invalidateProspectContext } from "./contextCache";

/**
 * §5.1/§7.6 — the shared function every AI call in this system builds
 * its prompt context from: never "dump the whole CRM," always this
 * layered, bounded model. §5.2's durable Redis cache (via getStore(),
 * already connected for the diesel-price editor) sits in front of each
 * compile function — a cache hit skips every Firestore read entirely.
 */

async function buildProspectContext(prospectId: string): Promise<string> {
  const prospect = await getProspect(prospectId);
  if (!prospect) return "";

  const [facts, openTasks, interactions] = await Promise.all([
    listFacts(prospectId),
    listTasks({ relatedProspectId: prospectId, status: "open" }),
    listInteractions(prospectId),
  ]);

  const activeFacts = facts.filter((f) => f.status === "active" || f.status === "confirmed").slice(0, 15);
  const recentInteractions = interactions.slice(0, 5);

  const lines: string[] = [
    `Prospect: ${prospect.name}`,
    `Stage: ${PIPELINE_STAGE_LABEL[prospect.stage]}`,
    prospect.contactName ? `Contact: ${prospect.contactName}${prospect.contactRole ? ` (${prospect.contactRole})` : ""}` : "Contact: not yet identified",
    prospect.location ? `Location: ${prospect.location}` : null,
    prospect.estimatedFleetSizeRaw ? `Estimated fleet size: ${prospect.estimatedFleetSizeRaw}` : null,
    prospect.primaryPainRaw ? `Known pain: ${prospect.primaryPainRaw}` : null,
    prospect.priorityScore !== null ? `Priority score: ${prospect.priorityScore}` : null,
    prospect.riskFlags.length ? `Risk flags: ${prospect.riskFlags.join(", ")}` : null,
    prospect.intelligence.summary ? `AI summary: ${prospect.intelligence.summary.value}` : null,
    prospect.visitorSnapshot
      ? `Website activity: ${prospect.visitorSnapshot.totalSessions} sessions, engagement ${prospect.visitorSnapshot.engagementScore}/100, intent ${prospect.visitorSnapshot.intentScore}/100`
      : null,
    activeFacts.length
      ? `Known facts:\n${activeFacts.map((f) => `- ${f.key}: ${f.value} (${f.source})`).join("\n")}`
      : "No facts recorded yet.",
    openTasks.length ? `Open tasks:\n${openTasks.map((t) => `- ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ""}`).join("\n")}` : "No open tasks.",
    recentInteractions.length
      ? `Recent interactions:\n${recentInteractions
          .map((i) => `- ${i.createdAt.slice(0, 10)} ${INTERACTION_TYPE_LABEL[i.type]}${i.outcome ? ` (${i.outcome})` : ""}${i.rawNote ? `: ${i.rawNote}` : ""}`)
          .join("\n")}`
      : "No interactions logged yet.",
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

async function buildEmployeeContext(employeeId: string): Promise<string> {
  const employee = await getAiEmployee(employeeId);
  if (!employee) return "";

  const [openTasks, recentEntries] = await Promise.all([
    listTasks({ relatedEmployeeId: employeeId, status: "open" }),
    listInboxEntries({ relatedEmployeeId: employeeId, limit: 5 }),
  ]);

  const lines: string[] = [
    `AI Employee: ${employee.name} (${employee.role})`,
    `Status: ${employee.status}`,
    `Mission: ${employee.mission}`,
    employee.instructions ? `Standing instructions: ${employee.instructions}` : null,
    openTasks.length ? `Open tasks:\n${openTasks.map((t) => `- ${t.title}`).join("\n")}` : "No open tasks.",
    recentEntries.length
      ? `Recent entries:\n${recentEntries.map((e) => `- [${e.sourceType}] ${e.rawText.slice(0, 160)}`).join("\n")}`
      : "No entries logged yet.",
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

async function buildGlobalContext(): Promise<string> {
  const decisions = await listDecisions({ status: "active" });
  const globalDecisions = decisions.filter((d) => d.scope.type === "global");

  const lines: string[] = [
    "DeployFleet is an AI-powered logistics operating system for trucking and logistics companies, initial market Zambia expanding to Southern Africa.",
    globalDecisions.length
      ? `Standing strategic decisions:\n${globalDecisions.map((d) => `- ${d.decisionText} (${d.reason})`).join("\n")}`
      : "No standing global decisions recorded yet.",
  ];

  return lines.join("\n\n");
}

export async function compileProspectContext(prospectId: string): Promise<string> {
  const store = getStore();
  const key = prospectContextKey(prospectId);
  const cached = await store.get<string>(key);
  if (cached !== null) return cached;

  const text = await buildProspectContext(prospectId);
  await store.set(key, text, CONTEXT_TTL_SECONDS);
  return text;
}

export async function compileEmployeeContext(employeeId: string): Promise<string> {
  const store = getStore();
  const key = employeeContextKey(employeeId);
  const cached = await store.get<string>(key);
  if (cached !== null) return cached;

  const text = await buildEmployeeContext(employeeId);
  await store.set(key, text, CONTEXT_TTL_SECONDS);
  return text;
}

export async function compileGlobalContext(): Promise<string> {
  const store = getStore();
  const cached = await store.get<string>(GLOBAL_CONTEXT_KEY);
  if (cached !== null) return cached;

  const text = await buildGlobalContext();
  await store.set(GLOBAL_CONTEXT_KEY, text, CONTEXT_TTL_SECONDS);
  return text;
}
