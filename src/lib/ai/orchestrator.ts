import "server-only";
import { pickToolAdapter } from "./router";
import { compileGlobalContext } from "./contextCompiler";
import { formatSystemState, getSystemState } from "./systemState";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts";
import { createAuditEvent, getProspect, listProspects } from "@/lib/crm";
import { PIPELINE_STAGE_LABEL } from "@/lib/crmTypes";
import type { ToolCallOutcome, ToolDefinition } from "./providers/types";

/**
 * Phase 2 §8.1 — the first genuinely agentic component in this codebase.
 * A bounded, at-most-2-round tool-calling exchange (§5.4): one round the
 * provider may call tools, one forced-final round with tools withheld
 * so a misbehaving model can't loop forever.
 *
 * §8.2's autonomy levels are implemented as a fixed, hand-written
 * registry below — never dynamic dispatch off an LLM-supplied string
 * beyond a fixed-key lookup, the same hardening this project's sibling
 * Odoo build already established for its own tool registry. Every
 * write-capable tool defaults to Level 0 ("propose, Winston approves")
 * per the doc's own explicit default ("everything in Phase 2 until
 * proven safe") — none are flipped to auto-execute in this initial
 * build. Read/summarize tools execute immediately since they mutate
 * nothing.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

interface ToolHandlerResult {
  summary: string;
}

interface ToolRegistryEntry {
  definition: ToolDefinition;
  autonomyLevel: AutonomyLevel;
  kind: "read" | "propose";
  /** "propose" tools: describes the action for the client's Approve card — never executes it. */
  describeProposal?: (args: Record<string, unknown>) => string;
  /** "read" tools: actually executes and returns a result fed back to the model. */
  handler?: (args: Record<string, unknown>) => Promise<ToolHandlerResult>;
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v : "";
}

async function generateDailyBrief(): Promise<ToolHandlerResult> {
  const state = await getSystemState();
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = await listProspects({ dueBy: today });
  const lines = [
    `${dueToday.length} prospect(s) due today or overdue.`,
    formatSystemState(state),
  ];
  return { summary: lines.join("\n") };
}

async function generatePipelineReport(): Promise<ToolHandlerResult> {
  const prospects = await listProspects({ includeArchived: false });
  const counts = new Map<number, number>();
  for (const p of prospects) counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1);
  const lines = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([stage, count]) => `${PIPELINE_STAGE_LABEL[stage as keyof typeof PIPELINE_STAGE_LABEL]}: ${count}`);
  return { summary: `Pipeline (${prospects.length} active prospects):\n${lines.join("\n")}` };
}

async function flagStaleInformation(args: Record<string, unknown>): Promise<ToolHandlerResult> {
  const prospectId = str(args, "prospectId");
  const prospect = prospectId ? await getProspect(prospectId) : null;
  if (!prospect) return { summary: "No such prospect — nothing to check." };

  const today = new Date().toISOString().slice(0, 10);
  const flags: string[] = [];
  const contactedSinceNextAction = prospect.lastContactDate !== null && prospect.nextActionDate !== null && prospect.lastContactDate >= prospect.nextActionDate;
  if (prospect.nextActionDate && prospect.nextActionDate < today && !contactedSinceNextAction) {
    flags.push(`Next action (${prospect.nextActionDate}) is overdue with no contact logged since.`);
  }
  if (prospect.stage > 2 && !prospect.contactName) {
    flags.push("No decision-maker contact name recorded.");
  }

  for (const flag of flags) {
    await createAuditEvent({
      eventType: "reconciliation_flag_raised",
      summary: `${prospect.name}: ${flag}`,
      relatedProspectId: prospectId,
      actor: "ai_reconciliation",
      metadata: { source: "orchestrator_tool" },
    });
  }

  return { summary: flags.length > 0 ? `Flags for ${prospect.name}: ${flags.join(" ")}` : `No issues found for ${prospect.name}.` };
}

const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  create_task: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "create_task",
      description: "Propose creating a new task, optionally linked to a prospect.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short, actionable task title." },
          description: { type: "string", description: "Optional longer description." },
          relatedProspectId: { type: "string", description: "Prospect id this task relates to, if any." },
          dueDate: { type: "string", description: "YYYY-MM-DD, if a due date applies." },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["title"],
      },
    },
    describeProposal: (args) => `Create task "${str(args, "title")}"${str(args, "dueDate") ? ` due ${str(args, "dueDate")}` : ""}.`,
  },
  update_task: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "update_task",
      description: "Propose updating an existing task's status, due date, or priority.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "The task's id." },
          status: { type: "string", enum: ["open", "in_progress", "done", "cancelled"] },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["taskId"],
      },
    },
    describeProposal: (args) => `Update task ${str(args, "taskId")}${str(args, "status") ? ` → ${str(args, "status")}` : ""}.`,
  },
  complete_task: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "complete_task",
      description: "Propose marking a task complete.",
      parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    },
    describeProposal: (args) => `Mark task ${str(args, "taskId")} complete.`,
  },
  create_prospect: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "create_prospect",
      description: "Propose adding a new prospect to the pipeline.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name." },
          location: { type: "string" },
          estimatedFleetSizeRaw: { type: "string" },
          primaryPainRaw: { type: "string" },
        },
        required: ["name"],
      },
    },
    describeProposal: (args) => `Add prospect "${str(args, "name")}"${str(args, "location") ? ` (${str(args, "location")})` : ""}.`,
  },
  update_prospect: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "update_prospect",
      description:
        "Propose updating a prospect's stage, next action, or note. Stage changes past 'Qualified Opportunity' always require Winston's direct review regardless of this tool's own autonomy level.",
      parameters: {
        type: "object",
        properties: {
          prospectId: { type: "string" },
          stage: { type: "string", description: "An integer 0-12 as a string, per DeployFleet's pipeline stages." },
          nextActionDate: { type: "string", description: "YYYY-MM-DD" },
          nextActionNote: { type: "string" },
        },
        required: ["prospectId"],
      },
    },
    describeProposal: (args) => `Update prospect ${str(args, "prospectId")}${str(args, "stage") ? ` → stage ${str(args, "stage")}` : ""}.`,
  },
  create_decision: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "create_decision",
      description: "Propose recording a new strategic decision in the Decision Ledger.",
      parameters: {
        type: "object",
        properties: {
          decisionText: { type: "string" },
          reason: { type: "string" },
          scopeType: { type: "string", enum: ["global", "prospect", "employee"] },
          scopeId: { type: "string", description: "Required when scopeType is prospect or employee." },
        },
        required: ["decisionText", "reason", "scopeType"],
      },
    },
    describeProposal: (args) => `Record decision: "${str(args, "decisionText")}" — ${str(args, "reason")}`,
  },
  supersede_decision: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "supersede_decision",
      description: "Propose superseding an existing decision with a new one.",
      parameters: {
        type: "object",
        properties: { decisionId: { type: "string" }, decisionText: { type: "string" }, reason: { type: "string" } },
        required: ["decisionId", "decisionText", "reason"],
      },
    },
    describeProposal: (args) => `Supersede decision ${str(args, "decisionId")} with: "${str(args, "decisionText")}"`,
  },
  request_ai_employee_report: {
    autonomyLevel: 0,
    kind: "propose",
    definition: {
      name: "request_ai_employee_report",
      description:
        "Propose a task asking one of the AI Workforce personas for a report or update — since there's no live channel to an external AI persona, this surfaces on the Team page as something Winston asks that employee himself.",
      parameters: {
        type: "object",
        properties: { employeeId: { type: "string" }, title: { type: "string", description: "e.g. 'Ask Charity for an update on Yeshua Logistics'" } },
        required: ["employeeId", "title"],
      },
    },
    describeProposal: (args) => str(args, "title") || `Ask employee ${str(args, "employeeId")} for a report.`,
  },
  flag_stale_information: {
    autonomyLevel: 1,
    kind: "read",
    definition: {
      name: "flag_stale_information",
      description: "Runs a quick staleness check (overdue next action, missing decision-maker) for one prospect and logs any flags found.",
      parameters: { type: "object", properties: { prospectId: { type: "string" } }, required: ["prospectId"] },
    },
    handler: flagStaleInformation,
  },
  generate_daily_brief: {
    autonomyLevel: 1,
    kind: "read",
    definition: {
      name: "generate_daily_brief",
      description: "Returns today's due/overdue prospect count and the current System State summary.",
      parameters: { type: "object", properties: {} },
    },
    handler: generateDailyBrief,
  },
  generate_pipeline_report: {
    autonomyLevel: 1,
    kind: "read",
    definition: {
      name: "generate_pipeline_report",
      description: "Returns a count of active prospects per pipeline stage.",
      parameters: { type: "object", properties: {} },
    },
    handler: generatePipelineReport,
  },
};

export interface OrchestratorProposal {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface OrchestratorToolLogEntry {
  tool: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

export interface OrchestratorTurnResult {
  ok: boolean;
  text: string;
  toolLog: OrchestratorToolLogEntry[];
  proposals: OrchestratorProposal[];
  provider?: string;
  reason?: string;
}

function parseArgs(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runOrchestratorTurn(userPrompt: string): Promise<OrchestratorTurnResult> {
  const adapter = pickToolAdapter();
  if (!adapter) {
    return { ok: false, text: "", toolLog: [], proposals: [], reason: "no_providers_configured" };
  }

  const [globalContext, systemState] = await Promise.all([compileGlobalContext(), getSystemState()]);
  const systemPrompt = `${ORCHESTRATOR_SYSTEM_PROMPT}\n\nGlobal context:\n${globalContext}\n\nCurrent system state:\n${formatSystemState(systemState)}`;
  const tools = Object.values(TOOL_REGISTRY).map((entry) => entry.definition);

  const round1 = await adapter.completeWithTools({ systemPrompt, userPrompt, tools });
  if (!round1.ok) {
    return { ok: false, text: "", toolLog: [], proposals: [], provider: round1.provider, reason: round1.reason };
  }
  if (round1.kind === "text") {
    return { ok: true, text: round1.text, toolLog: [], proposals: [], provider: round1.provider };
  }

  const toolLog: OrchestratorToolLogEntry[] = [];
  const proposals: OrchestratorProposal[] = [];
  const outcomes: ToolCallOutcome[] = [];

  for (const call of round1.calls) {
    const entry = TOOL_REGISTRY[call.name];
    const args = parseArgs(call.argumentsJson);

    if (!entry) {
      outcomes.push({ toolCall: call, resultText: "Unknown tool — ignored." });
      continue;
    }

    if (entry.kind === "propose") {
      const description = entry.describeProposal!(args);
      proposals.push({ tool: call.name, args, description });
      const resultText = `Proposed (not executed — awaiting Winston's approval): ${description}`;
      outcomes.push({ toolCall: call, resultText });
      toolLog.push({ tool: call.name, args, resultSummary: resultText });
      continue;
    }

    const result = await entry.handler!(args);
    outcomes.push({ toolCall: call, resultText: result.summary });
    toolLog.push({ tool: call.name, args, resultSummary: result.summary });
  }

  const round2 = await adapter.completeWithTools({
    systemPrompt,
    userPrompt,
    tools,
    priorToolOutcomes: outcomes,
    forceFinal: true,
  });

  if (!round2.ok) {
    return { ok: false, text: "", toolLog, proposals, provider: round2.provider, reason: round2.reason };
  }
  const finalText = round2.kind === "text" ? round2.text : "Done.";
  return { ok: true, text: finalText, toolLog, proposals, provider: round2.provider };
}
