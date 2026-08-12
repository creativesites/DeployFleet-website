import { describe, expect, it } from "vitest";
import { classifyZambianPhone, toInternationalPhoneDigits } from "./phoneRules";

describe("classifyZambianPhone", () => {
  it("classifies a 211 Lusaka landline", () => {
    const result = classifyZambianPhone("+260 211 287 695");
    expect(result.type).toBe("landline");
    expect(result.recommendedChannel).toBe("call");
  });

  it("classifies a 212 Ndola/Copperbelt landline", () => {
    const result = classifyZambianPhone("+260 212 650 452");
    expect(result.type).toBe("landline");
  });

  it("classifies a 097 mobile as Airtel", () => {
    const result = classifyZambianPhone("+260 977 929 253");
    expect(result.type).toBe("mobile");
    expect(result.carrier).toBe("Airtel");
    expect(result.recommendedChannel).toBe("whatsapp");
  });

  it("classifies a 096 mobile as MTN", () => {
    const result = classifyZambianPhone("+260 966 999 219");
    expect(result.carrier).toBe("MTN");
  });

  it("handles a local-format number with a leading 0", () => {
    const result = classifyZambianPhone("0977929253");
    expect(result.type).toBe("mobile");
    expect(result.carrier).toBe("Airtel");
  });

  it("flags a round-number pattern anomaly without calling it invalid", () => {
    const result = classifyZambianPhone("+260 966 999 219");
    expect(result.patternAnomaly).toBe(true);
    expect(result.type).toBe("mobile"); // still classified, not rejected
  });

  it("does not flag an ordinary-looking number as anomalous", () => {
    const result = classifyZambianPhone("+260 972 596 371");
    expect(result.patternAnomaly).toBe(false);
  });

  it("returns unknown/call for null input rather than throwing", () => {
    const result = classifyZambianPhone(null);
    expect(result.type).toBe("unknown");
    expect(result.recommendedChannel).toBe("call");
  });

  it("returns unknown/call for an unrecognized prefix", () => {
    const result = classifyZambianPhone("+260 300 000 000");
    expect(result.type).toBe("unknown");
  });
});

describe("toInternationalPhoneDigits", () => {
  it("converts a domestic-format number (leading 0) to the full international digit string", () => {
    expect(toInternationalPhoneDigits("0977929253")).toBe("260977929253");
  });

  it("leaves an already-international number's digits unchanged", () => {
    expect(toInternationalPhoneDigits("+260 977 929 253")).toBe("260977929253");
  });

  it("prefixes a bare local number with no leading 0 or country code", () => {
    expect(toInternationalPhoneDigits("977929253")).toBe("260977929253");
  });
});
