/**
 * Shared contract every AI provider adapter implements. The router
 * (../router.ts) only ever talks to this interface — it doesn't know or
 * care whether it's calling DeepSeek, Gemini, or anything added later.
 * See the Intelligence Hub plan §03 "Layer 2 — the AI service."
 */

export type ProviderName = "deepseek" | "gemini";

export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiCompletionSuccess {
  ok: true;
  text: string;
  provider: ProviderName;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AiCompletionFailure {
  ok: false;
  provider: ProviderName;
  reason: string;
}

export type AiCompletionResult = AiCompletionSuccess | AiCompletionFailure;

export interface AiProviderAdapter {
  name: ProviderName;
  /** True only when this provider has the config it needs (an API key). */
  isConfigured(): boolean;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

/**
 * Phase 2 §5.4/§8.1 — provider-native tool-calling, the one genuinely new
 * piece of AI-router engineering this system needed. A JSON-schema
 * subset (object/properties/required) is enough for the Orchestrator's
 * own small, hand-written tool registry — no need for the full JSON
 * Schema spec.
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string, exactly as the provider returned it — the caller parses it, same discipline as parseJsonLoosely() elsewhere in this project. */
  argumentsJson: string;
}

/** One executed tool call's outcome, fed back to the model on the forced-final round. */
export interface ToolCallOutcome {
  toolCall: ToolCall;
  resultText: string;
}

export interface AiToolTurnRequest {
  systemPrompt: string;
  userPrompt: string;
  tools: ToolDefinition[];
  /** Present on the forced-final round — prior tool calls plus their outcomes, folded back into the conversation. */
  priorToolOutcomes?: ToolCallOutcome[];
  /** When true, tools are withheld — the provider must answer in plain text. Used for the forced-final round of the bounded 2-round exchange (§5.4). */
  forceFinal?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

export type AiToolTurnResult =
  | { ok: true; kind: "tool_calls"; calls: ToolCall[]; provider: ProviderName }
  | { ok: true; kind: "text"; text: string; provider: ProviderName }
  | { ok: false; provider: ProviderName; reason: string };

export interface AiToolCallingAdapter {
  name: ProviderName;
  isConfigured(): boolean;
  completeWithTools(request: AiToolTurnRequest): Promise<AiToolTurnResult>;
}
