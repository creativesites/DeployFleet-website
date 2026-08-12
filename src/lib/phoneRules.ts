import type { PhoneClassification } from "./crmTypes";

/**
 * Brief #8 — a configurable, country-specific phone ruleset rather than
 * a permanent universal truth hard-coded into call sites. Zambia is the
 * only country implemented (DeployFleet's current market); this is
 * deliberately shaped so a second country's rules could be added as a
 * sibling table, not a rewrite.
 */
interface CountryPhoneRules {
  countryCode: string;
  landlinePrefixes: string[];
  carrierPrefixes: { prefix: string; carrier: "Airtel" | "MTN" }[];
}

// Carrier prefixes are the 2-digit form with the domestic leading "0"
// already stripped off — a Zambian mobile written domestically as
// "0977 xxx xxx" becomes "+260 977 xxx xxx" internationally, so once
// normalizeDigits() below strips either the "260" country code or a
// local leading "0", both paths land on the same "977xxxxxx" shape.
// Landline prefixes need no such adjustment: "0211 xxxxxx" <->
// "+260 211 xxxxxx" already lines up without a leading-zero offset.
const ZAMBIA_RULES: CountryPhoneRules = {
  countryCode: "260",
  landlinePrefixes: ["211", "212", "213", "214", "215", "216", "217", "218"],
  carrierPrefixes: [
    { prefix: "97", carrier: "Airtel" },
    { prefix: "77", carrier: "Airtel" },
    { prefix: "57", carrier: "Airtel" },
    { prefix: "96", carrier: "MTN" },
    { prefix: "76", carrier: "MTN" },
  ],
};

function normalizeDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** Brief #9 — a pattern flag is a signal to double-check, never proof the number is invalid on its own; see the recommendedChannel/patternAnomaly split below, both surfaced, neither hiding the other. */
function hasSuspiciousPattern(localDigits: string): boolean {
  if (/(\d)\1{3,}/.test(localDigits)) return true; // 4+ of the same digit in a row anywhere, e.g. ...9999...
  if (/000|500|999|111|222/.test(localDigits)) return true; // a round/repeated triplet anywhere, e.g. ...999...
  if (/123$/.test(localDigits)) return true; // trailing 123 specifically — too common a substring elsewhere to check anywhere
  if (/0123456789/.test(localDigits) || /9876543210/.test(localDigits)) return true;
  for (let start = 0; start + 6 <= localDigits.length; start++) {
    const window = localDigits.slice(start, start + 6).split("").map(Number);
    const ascending = window.every((d, i) => i === 0 || d === (window[i - 1] + 1) % 10);
    const descending = window.every((d, i) => i === 0 || d === (window[i - 1] + 9) % 10);
    if (ascending || descending) return true;
  }
  return false;
}

/**
 * Classifies a raw phone string (any formatting) against Zambia's dialing
 * plan. Never throws on malformed input — returns "unknown"/"call" as the
 * safe default rather than blocking a prospect record from being created.
 */
export function classifyZambianPhone(raw: string | null | undefined): PhoneClassification {
  if (!raw) {
    return { type: "unknown", carrier: null, recommendedChannel: "call", patternAnomaly: false };
  }

  const digits = normalizeDigits(raw);
  // Strip a leading country code (260) or trunk prefix (0) to get the local significant number.
  let local = digits;
  if (local.startsWith(ZAMBIA_RULES.countryCode)) local = local.slice(ZAMBIA_RULES.countryCode.length);
  else if (local.startsWith("0")) local = local.slice(1);

  const patternAnomaly = hasSuspiciousPattern(local);

  for (const prefix of ZAMBIA_RULES.landlinePrefixes) {
    if (local.startsWith(prefix)) {
      return { type: "landline", carrier: null, recommendedChannel: "call", patternAnomaly };
    }
  }

  for (const { prefix, carrier } of ZAMBIA_RULES.carrierPrefixes) {
    if (local.startsWith(prefix)) {
      return { type: "mobile", carrier, recommendedChannel: "whatsapp", patternAnomaly };
    }
  }

  return { type: "unknown", carrier: null, recommendedChannel: "call", patternAnomaly };
}

/**
 * WhatsApp's own `onWhatsApp()` primitive (the gateway's checkAvailability(),
 * §6 of docs/whatsapp-intelligence-architecture.md) needs the full
 * international digit string — country code, no leading trunk "0" — not
 * whatever local/domestic format a number happens to be stored in.
 * `Prospect.contactPhone`/`contactWhatsapp` are stored as originally
 * entered (often domestic "0977xxxxxx"), so every call site that hands a
 * phone number to the gateway must normalize through this first — a real
 * bug caught live on the demo server (verify was silently checking the
 * wrong digit string entirely, e.g. "0977123456" instead of
 * "260977123456"). Reuses classifyZambianPhone()'s own leading-zero/
 * country-code stripping logic rather than re-deriving it.
 */
export function toInternationalPhoneDigits(raw: string): string {
  const digits = normalizeDigits(raw);
  let local = digits;
  if (local.startsWith(ZAMBIA_RULES.countryCode)) local = local.slice(ZAMBIA_RULES.countryCode.length);
  else if (local.startsWith("0")) local = local.slice(1);
  return `${ZAMBIA_RULES.countryCode}${local}`;
}
