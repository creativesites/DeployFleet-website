import { describe, expect, it, vi } from "vitest";
import { completeWithFallback } from "./router";
import type { AiCompletionRequest, AiProviderAdapter } from "./providers/types";

const baseRequest: AiCompletionRequest = {
  systemPrompt: "You are a fleet analyst.",
  userPrompt: "Explain this cost per km result.",
};

function fakeAdapter(overrides: Partial<AiProviderAdapter> & { name: AiProviderAdapter["name"] }): AiProviderAdapter {
  return {
    isConfigured: () => true,
    complete: vi.fn().mockResolvedValue({ ok: true, text: "ok", provider: overrides.name }),
    ...overrides,
  };
}

describe("completeWithFallback", () => {
  it("returns the first provider's result when it succeeds", async () => {
    const deepseek = fakeAdapter({
      name: "deepseek",
      complete: vi.fn().mockResolvedValue({ ok: true, text: "deepseek says hi", provider: "deepseek" }),
    });
    const gemini = fakeAdapter({ name: "gemini", complete: vi.fn() });

    const result = await completeWithFallback(baseRequest, [deepseek, gemini]);

    expect(result).toEqual({ ok: true, text: "deepseek says hi", provider: "deepseek" });
    expect(gemini.complete).not.toHaveBeenCalled();
  });

  it("falls back to the second provider when the first fails", async () => {
    const deepseek = fakeAdapter({
      name: "deepseek",
      complete: vi.fn().mockResolvedValue({ ok: false, provider: "deepseek", reason: "timeout" }),
    });
    const gemini = fakeAdapter({
      name: "gemini",
      complete: vi.fn().mockResolvedValue({ ok: true, text: "gemini says hi", provider: "gemini" }),
    });

    const result = await completeWithFallback(baseRequest, [deepseek, gemini]);

    expect(result).toEqual({ ok: true, text: "gemini says hi", provider: "gemini" });
    expect(deepseek.complete).toHaveBeenCalledTimes(1);
    expect(gemini.complete).toHaveBeenCalledTimes(1);
  });

  it("skips an unconfigured provider without calling complete()", async () => {
    const deepseek = fakeAdapter({ name: "deepseek", isConfigured: () => false, complete: vi.fn() });
    const gemini = fakeAdapter({
      name: "gemini",
      complete: vi.fn().mockResolvedValue({ ok: true, text: "gemini only", provider: "gemini" }),
    });

    const result = await completeWithFallback(baseRequest, [deepseek, gemini]);

    expect(result).toEqual({ ok: true, text: "gemini only", provider: "gemini" });
    expect(deepseek.complete).not.toHaveBeenCalled();
  });

  it("returns the last failure when every provider fails", async () => {
    const deepseek = fakeAdapter({
      name: "deepseek",
      complete: vi.fn().mockResolvedValue({ ok: false, provider: "deepseek", reason: "timeout" }),
    });
    const gemini = fakeAdapter({
      name: "gemini",
      complete: vi.fn().mockResolvedValue({ ok: false, provider: "gemini", reason: "http_500" }),
    });

    const result = await completeWithFallback(baseRequest, [deepseek, gemini]);

    expect(result).toEqual({ ok: false, provider: "gemini", reason: "http_500" });
  });

  it("returns a not_configured failure when no adapters are configured", async () => {
    const deepseek = fakeAdapter({ name: "deepseek", isConfigured: () => false, complete: vi.fn() });
    const gemini = fakeAdapter({ name: "gemini", isConfigured: () => false, complete: vi.fn() });

    const result = await completeWithFallback(baseRequest, [deepseek, gemini]);

    expect(result.ok).toBe(false);
    expect(deepseek.complete).not.toHaveBeenCalled();
    expect(gemini.complete).not.toHaveBeenCalled();
  });

  it("never calls a provider after one has already succeeded", async () => {
    const deepseek = fakeAdapter({
      name: "deepseek",
      complete: vi.fn().mockResolvedValue({ ok: true, text: "first", provider: "deepseek" }),
    });
    const secondary = fakeAdapter({ name: "gemini", complete: vi.fn() });

    await completeWithFallback(baseRequest, [deepseek, secondary]);

    expect(secondary.complete).not.toHaveBeenCalled();
  });
});
