import { deepseekAdapter, deepseekToolAdapter } from "./providers/deepseek";
import { geminiAdapter, geminiToolAdapter } from "./providers/gemini";
import type { AiCompletionRequest, AiCompletionResult, AiProviderAdapter, AiToolCallingAdapter } from "./providers/types";

/**
 * Provider Router — Layer 2's single entry point. Tries providers in
 * order, falling forward on any failure (unconfigured, timeout, error,
 * empty response) until one succeeds or all are exhausted.
 *
 * The `adapters` parameter defaults to the real DeepSeek→Gemini order but
 * accepts injected fakes for testing, so the fallback logic itself is
 * unit-tested without mocking fetch or environment variables — see
 * router.test.ts.
 */

const DEFAULT_ADAPTERS: AiProviderAdapter[] = [deepseekAdapter, geminiAdapter];

export async function completeWithFallback(
  request: AiCompletionRequest,
  adapters: AiProviderAdapter[] = DEFAULT_ADAPTERS
): Promise<AiCompletionResult> {
  let lastResult: AiCompletionResult | null = null;

  for (const adapter of adapters) {
    if (!adapter.isConfigured()) {
      lastResult = { ok: false, provider: adapter.name, reason: "not_configured" };
      continue;
    }

    const result = await adapter.complete(request);
    if (result.ok) {
      return result;
    }
    lastResult = result;
  }

  return lastResult ?? { ok: false, provider: "deepseek", reason: "no_providers_configured" };
}

const DEFAULT_TOOL_ADAPTERS: AiToolCallingAdapter[] = [deepseekToolAdapter, geminiToolAdapter];

/**
 * §5.4/§8.1 — picks the first configured tool-calling adapter. Unlike
 * completeWithFallback() above, a tool-calling exchange can't fall back
 * mid-conversation: DeepSeek's and Gemini's message/tool-call formats
 * aren't interchangeable, so once a round starts it has to finish on the
 * same provider. The Orchestrator (orchestrator.ts) calls this once per
 * turn, then drives both rounds of that turn against the same adapter.
 */
export function pickToolAdapter(adapters: AiToolCallingAdapter[] = DEFAULT_TOOL_ADAPTERS): AiToolCallingAdapter | null {
  return adapters.find((a) => a.isConfigured()) ?? null;
}
