import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_LIST, DEFAULT_COUNTRY_CODE, formatMoney, getCountry } from "./countries";

describe("countries", () => {
  it("defaults to Zambia", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("ZM");
    expect(getCountry("ZM").coverage).toBe("full");
  });

  it("marks Zambia and Zimbabwe as fully covered, the other four as currency-only", () => {
    expect(COUNTRIES.ZM.coverage).toBe("full");
    expect(COUNTRIES.ZW.coverage).toBe("full");
    for (const code of ["ZA", "BW", "NA", "MZ"] as const) {
      expect(COUNTRIES[code].coverage).toBe("currency-only");
      expect(COUNTRIES[code].incomeTax).toBeNull();
      expect(COUNTRIES[code].dieselPricePerLitre).toBeNull();
    }
  });

  it("gives Zimbabwe USD as its currency, not ZWG", () => {
    expect(COUNTRIES.ZW.currencyCode).toBe("USD");
    expect(COUNTRIES.ZW.currencySymbol).toBe("US$");
  });

  it("falls back to the default country for an unknown code", () => {
    // @ts-expect-error deliberately passing an invalid code to test the fallback
    expect(getCountry("XX").code).toBe("ZM");
  });

  it("lists all 6 target countries", () => {
    expect(COUNTRY_LIST).toHaveLength(6);
    expect(COUNTRY_LIST.map((c) => c.code).sort()).toEqual(["BW", "MZ", "NA", "ZA", "ZM", "ZW"]);
  });

  it("formats money with the country's own symbol and locale", () => {
    expect(formatMoney(1234.5, COUNTRIES.ZM)).toBe("K1,234.50");
    expect(formatMoney(1234.5, COUNTRIES.ZW)).toBe("US$1,234.50");
  });
});
