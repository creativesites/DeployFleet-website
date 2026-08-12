import "server-only";

/**
 * The "team works cohesively" mechanism Winston asked for: AiEmployee
 * personas (Charity/AI SDR, Bupe/AI Sales Coach, etc.) are, per this
 * codebase's own established design, "a persona Winston pastes
 * conversations on behalf of, not a live autonomous agent" — he
 * actually chats with them somewhere external (ChatGPT/Claude/DeepSeek's
 * own chat UI, using each persona's role/mission/instructions as a
 * system prompt he keeps there), then pastes their reply into this
 * app's AI Inbox. The missing piece was the *other* direction: getting
 * this app's own prospect context out, formatted for that external
 * chat, without Winston re-typing it by hand every time. This builds
 * that handoff text — plain, copy-pasteable, no formatting an external
 * chat UI would mangle.
 */

export interface BriefingSubject {
  name: string;
  role: string;
  mission: string;
  instructions: string;
}

export function buildEmployeeBriefing(employee: BriefingSubject, prospectContext: string, purpose?: string): string {
  const lines = [
    `You are ${employee.name}, ${employee.role} for DeployFleet.`,
    `Mission: ${employee.mission}`,
    employee.instructions ? `Standing instructions: ${employee.instructions}` : null,
    "",
    "--- Prospect context ---",
    prospectContext || "(no prospect context — this is a general ask, not scoped to one prospect)",
    "",
    purpose ? `--- What I need from you right now ---\n${purpose}` : null,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}
