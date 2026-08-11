/**
 * Best-effort JSON extraction from an LLM's raw text response — models
 * occasionally wrap otherwise-valid JSON in markdown code fences despite
 * being told not to. Returns null (never throws) on anything that still
 * doesn't parse, so a malformed AI response degrades to "unavailable"
 * rather than a 500.
 */
export function parseJsonLoosely<T>(text: string): T | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}
