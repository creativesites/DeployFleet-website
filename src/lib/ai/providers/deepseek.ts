import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderAdapter,
  AiToolCallingAdapter,
  AiToolTurnRequest,
  AiToolTurnResult,
} from "./types";

/**
 * DeepSeek adapter — OpenAI-compatible chat completions API.
 *
 * Implemented to DeepSeek's documented request/response shape. Not
 * verified against a live call from this environment (no API key
 * available here) — same honesty standard as the rest of this project's
 * AI work. Once DEEPSEEK_API_KEY is set in Vercel, this starts working
 * with no code change required.
 */

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
const TIMEOUT_MS = 12_000;

export const deepseekAdapter: AiProviderAdapter = {
  name: "deepseek",

  isConfigured() {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { ok: false, provider: "deepseek", reason: "not_configured" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxOutputTokens ?? 300,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, provider: "deepseek", reason: `http_${response.status}` };
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, provider: "deepseek", reason: "empty_response" };
      }

      return {
        ok: true,
        text: text.trim(),
        provider: "deepseek",
        usage: {
          inputTokens: data?.usage?.prompt_tokens,
          outputTokens: data?.usage?.completion_tokens,
        },
      };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
      return { ok: false, provider: "deepseek", reason };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

/**
 * §5.4/§8.1 — DeepSeek's OpenAI-compatible tools/tool_calls shape.
 * Implemented to the well-documented, stable API contract; not yet
 * verified against a live call from this dev environment (no API key
 * here), same honesty standard as every other AI integration in this
 * project. A bounded, at-most-2-round exchange is orchestrated by the
 * caller (orchestrator.ts) via `forceFinal` — this function only ever
 * makes one HTTP call per invocation.
 */
export const deepseekToolAdapter: AiToolCallingAdapter = {
  name: "deepseek",

  isConfigured() {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async completeWithTools(request: AiToolTurnRequest): Promise<AiToolTurnResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { ok: false, provider: "deepseek", reason: "not_configured" };
    }

    const messages: OpenAiChatMessage[] = [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userPrompt },
    ];

    if (request.priorToolOutcomes && request.priorToolOutcomes.length > 0) {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: request.priorToolOutcomes.map((o) => ({
          id: o.toolCall.id,
          type: "function",
          function: { name: o.toolCall.name, arguments: o.toolCall.argumentsJson },
        })),
      });
      for (const outcome of request.priorToolOutcomes) {
        messages.push({ role: "tool", content: outcome.resultText, tool_call_id: outcome.toolCall.id });
      }
    }

    const body: Record<string, unknown> = {
      model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxOutputTokens ?? 500,
    };
    if (!request.forceFinal) {
      body.tools = request.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = "auto";
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, provider: "deepseek", reason: `http_${response.status}` };
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;
      const toolCalls: OpenAiToolCall[] | undefined = message?.tool_calls;

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        return {
          ok: true,
          kind: "tool_calls",
          provider: "deepseek",
          calls: toolCalls.map((tc) => ({ id: tc.id, name: tc.function.name, argumentsJson: tc.function.arguments })),
        };
      }

      const text = message?.content;
      if (typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, provider: "deepseek", reason: "empty_response" };
      }
      return { ok: true, kind: "text", text: text.trim(), provider: "deepseek" };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
      return { ok: false, provider: "deepseek", reason };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
