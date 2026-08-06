import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimitState, checkRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimitState();
  });

  it("allows the first request for a fresh key", () => {
    const result = checkRateLimit("1.2.3.4:cost-per-km", 1000, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("counts down remaining across calls within the window", () => {
    checkRateLimit("k", 1000, 3);
    checkRateLimit("k", 1100, 3);
    const third = checkRateLimit("k", 1200, 3);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("denies once the limit is reached within the window", () => {
    checkRateLimit("k", 1000, 3);
    checkRateLimit("k", 1100, 3);
    checkRateLimit("k", 1200, 3);
    const fourth = checkRateLimit("k", 1300, 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("resets once the window has elapsed", () => {
    checkRateLimit("k", 1000, 3);
    checkRateLimit("k", 1000, 3);
    checkRateLimit("k", 1000, 3);
    expect(checkRateLimit("k", 1000, 3).allowed).toBe(false);

    const DAY_MS = 24 * 60 * 60 * 1000;
    const afterWindow = checkRateLimit("k", 1000 + DAY_MS, 3);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(2);
  });

  it("tracks separate keys independently", () => {
    checkRateLimit("a", 1000, 1);
    const second = checkRateLimit("b", 1000, 1);
    expect(second.allowed).toBe(true);
  });
});
