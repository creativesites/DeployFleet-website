import { beforeEach, describe, expect, it } from "vitest";
import { _resetCacheState, getCached, setCached } from "./cache";
import type { AiCompletionResult } from "./providers/types";

const success: AiCompletionResult = { ok: true, text: "cached answer", provider: "deepseek" };
const failure: AiCompletionResult = { ok: false, provider: "deepseek", reason: "timeout" };

describe("AI response cache", () => {
  beforeEach(() => {
    _resetCacheState();
  });

  it("returns null for a key that was never set", () => {
    expect(getCached("missing")).toBeNull();
  });

  it("returns a cached successful result", () => {
    setCached("key", success, 1000);
    expect(getCached("key", 1000)).toEqual(success);
  });

  it("never caches a failure", () => {
    setCached("key", failure, 1000);
    expect(getCached("key", 1000)).toBeNull();
  });

  it("expires an entry after the TTL elapses", () => {
    setCached("key", success, 1000);
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    expect(getCached("key", 1000 + SIX_HOURS_MS + 1)).toBeNull();
  });

  it("still serves the entry right at the edge of the TTL", () => {
    setCached("key", success, 1000);
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    expect(getCached("key", 1000 + SIX_HOURS_MS)).toEqual(success);
  });
});
