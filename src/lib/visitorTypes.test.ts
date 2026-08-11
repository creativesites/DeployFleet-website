import { describe, expect, it } from "vitest";
import { EMPTY_UTM, classifyReferrer, hasUtmSignal, referrerDomain } from "./visitorTypes";
import type { UtmParams } from "./visitorTypes";

describe("classifyReferrer", () => {
  it("classifies no referrer and no UTM as direct", () => {
    expect(classifyReferrer(null, EMPTY_UTM)).toBe("direct");
  });

  it("classifies a gclid as paid_search", () => {
    expect(classifyReferrer(null, { ...EMPTY_UTM, gclid: "abc" })).toBe("paid_search");
  });

  it("classifies utm_medium=cpc as paid_search even with a referrer present", () => {
    expect(classifyReferrer("https://example.com", { ...EMPTY_UTM, utmMedium: "cpc" })).toBe("paid_search");
  });

  it("classifies fbclid as social", () => {
    expect(classifyReferrer(null, { ...EMPTY_UTM, fbclid: "xyz" })).toBe("social");
  });

  it("classifies a google.com referrer as organic_search", () => {
    expect(classifyReferrer("https://www.google.com/search?q=trucking", EMPTY_UTM)).toBe("organic_search");
  });

  it("classifies a facebook.com referrer as social", () => {
    expect(classifyReferrer("https://facebook.com/somepage", EMPTY_UTM)).toBe("social");
  });

  it("classifies a wa.me referrer as whatsapp", () => {
    expect(classifyReferrer("https://wa.me/260971234567", EMPTY_UTM)).toBe("whatsapp");
  });

  it("classifies an unrecognized external domain as referral", () => {
    expect(classifyReferrer("https://someothersite.co.zm/page", EMPTY_UTM)).toBe("referral");
  });

  it("classifies a present utm_campaign (with no other signal) as campaign", () => {
    expect(classifyReferrer(null, { ...EMPTY_UTM, utmCampaign: "aug-launch" })).toBe("campaign");
  });

  it("classifies an unparseable referrer string as unknown", () => {
    expect(classifyReferrer("not a url", EMPTY_UTM)).toBe("unknown");
  });
});

describe("referrerDomain", () => {
  it("strips the www. prefix", () => {
    expect(referrerDomain("https://www.google.com/search")).toBe("google.com");
  });

  it("returns null for no referrer", () => {
    expect(referrerDomain(null)).toBeNull();
  });

  it("returns null for an unparseable referrer", () => {
    expect(referrerDomain("not a url")).toBeNull();
  });
});

describe("hasUtmSignal", () => {
  it("is false for EMPTY_UTM", () => {
    expect(hasUtmSignal(EMPTY_UTM)).toBe(false);
  });

  it("is true when any single field is set", () => {
    const utm: UtmParams = { ...EMPTY_UTM, utmSource: "newsletter" };
    expect(hasUtmSignal(utm)).toBe(true);
  });
});
