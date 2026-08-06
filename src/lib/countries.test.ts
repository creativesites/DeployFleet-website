import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_LIST, DEFAULT_COUNTRY_CODE, formatMoney, getCountry } from "./countries";

describe("countries", () => {
  it("defaults to Zambia", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("ZM");
    expect(getCountry("ZM").coverage).toBe("full");
  });

  it("marks all 6 target countries as fully covered", () => {
    for (const code of ["ZM", "ZW", "ZA", "BW", "NA", "MZ"] as const) {
      expect(COUNTRIES[code].coverage).toBe("full");
      expect(COUNTRIES[code].incomeTax).not.toBeNull();
      expect(COUNTRIES[code].socialSecurity).not.toBeNull();
      expect(COUNTRIES[code].dieselPricePerLitre).not.toBeNull();
    }
  });

  it("gives Botswana and Namibia a genuine sourced zero for tolls, not a missing value", () => {
    expect(COUNTRIES.BW.tolls?.value.fourPlusAxleHeavy).toBe(0);
    expect(COUNTRIES.NA.tolls?.value.fourPlusAxleHeavy).toBe(0);
  });

  it("allows a null social security cap for an uncapped scheme (Mozambique's INSS)", () => {
    expect(COUNTRIES.MZ.socialSecurity?.value.employeeCapPerMonth).toBeNull();
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
