import { deepseekAdapter } from "./providers/deepseek";
import { geminiAdapter } from "./providers/gemini";
import type { AiCompletionRequest, AiCompletionResult, AiProviderAdapter } from "./providers/types";

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
