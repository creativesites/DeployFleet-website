import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProviderAdapter,
  AiToolCallingAdapter,
  AiToolTurnRequest,
  AiToolTurnResult,
} from "./types";

/**
 * Gemini adapter — Google's generateContent API. Fallback provider,
 * used only when DeepSeek is unconfigured or fails — see router.ts.
 *
 * Implemented to Gemini's documented request/response shape. Not
 * verified against a live call from this environment (no API key
 * available here) — same caveat as the DeepSeek adapter.
 */

const DEFAULT_MODEL = "gemini-2.0-flash";
const TIMEOUT_MS = 12_000;

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export const geminiAdapter: AiProviderAdapter = {
  name: "gemini",

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, provider: "gemini", reason: "not_configured" };
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${endpointFor(model)}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          generationConfig: {
            temperature: request.temperature ?? 0.4,
            maxOutputTokens: request.maxOutputTokens ?? 300,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, provider: "gemini", reason: `http_${response.status}` };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string" || text.trim().length === 0) {
        return { ok: false, provider: "gemini", reason: "empty_response" };
      }

      return {
        ok: true,
        text: text.trim(),
        provider: "gemini",
        usage: {
          inputTokens: data?.usageMetadata?.promptTokenCount,
          outputTokens: data?.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
      return { ok: false, provider: "gemini", reason };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: { name: string; response: { result: string } };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

function safeParseArgs(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * §5.4/§8.1 — Gemini's own function-calling shape (`tools` with
 * `functionDeclarations`, `functionCall`/`functionResponse` content
 * parts), genuinely different from DeepSeek's OpenAI-compatible one —
 * implemented separately rather than through a shared abstraction, per
 * the architecture doc's own call. Implemented to the documented v1beta
 * REST shape; not yet verified against a live call (no API key in this
 * dev environment). Gemini's API has no per-call id the way OpenAI does,
 * so ids are generated client-side purely for this project's own
 * ToolCall shape — the replayed conversation correlates by function
 * name, matching how Gemini's own protocol actually works.
 */
export const geminiToolAdapter: AiToolCallingAdapter = {
  name: "gemini",

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
  },

  async completeWithTools(request: AiToolTurnRequest): Promise<AiToolTurnResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, provider: "gemini", reason: "not_configured" };
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const contents: GeminiContent[] = [{ role: "user", parts: [{ text: request.userPrompt }] }];

    if (request.priorToolOutcomes && request.priorToolOutcomes.length > 0) {
      contents.push({
        role: "model",
        parts: request.priorToolOutcomes.map((o) => ({
          functionCall: { name: o.toolCall.name, args: safeParseArgs(o.toolCall.argumentsJson) },
        })),
      });
      contents.push({
        role: "function",
        parts: request.priorToolOutcomes.map((o) => ({
          functionResponse: { name: o.toolCall.name, response: { result: o.resultText } },
        })),
      });
    }

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: { parts: [{ text: request.systemPrompt }] },
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxOutputTokens ?? 500,
      },
    };
    if (!request.forceFinal) {
      body.tools = [{ functionDeclarations: request.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
      body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    } else {
      body.toolConfig = { functionCallingConfig: { mode: "NONE" } };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${endpointFor(model)}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, provider: "gemini", reason: `http_${response.status}` };
      }

      const data = await response.json();
      const parts: GeminiPart[] | undefined = data?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) {
        return { ok: false, provider: "gemini", reason: "empty_response" };
      }

      const functionCallParts = parts.filter((p) => p.functionCall);
      if (functionCallParts.length > 0) {
        return {
          ok: true,
          kind: "tool_calls",
          provider: "gemini",
          calls: functionCallParts.map((p, i) => ({
            id: `gemini-call-${Date.now()}-${i}`,
            name: p.functionCall!.name,
            argumentsJson: JSON.stringify(p.functionCall!.args ?? {}),
          })),
        };
      }

      const text = parts
        .map((p) => p.text)
        .filter((t): t is string => Boolean(t))
        .join("");
      if (!text.trim()) {
        return { ok: false, provider: "gemini", reason: "empty_response" };
      }
      return { ok: true, kind: "text", text: text.trim(), provider: "gemini" };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
      return { ok: false, provider: "gemini", reason };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
