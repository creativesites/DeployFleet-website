import type { AiCompletionRequest, AiCompletionResult, AiProviderAdapter } from "./types";

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
