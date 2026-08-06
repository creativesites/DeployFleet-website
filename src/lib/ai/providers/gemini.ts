import type { AiCompletionRequest, AiCompletionResult, AiProviderAdapter } from "./types";

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
