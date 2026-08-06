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
