import { describe, it, expect } from "vitest";
import { money, currencySymbol, CURRENCY_DEFAULTS } from "./money.js";

describe("money", () => {
  it("matches the original hardcoded ZMW formatter with no currency arg", () => {
    const legacy = (n) => "K" + Number(n).toLocaleString("en-ZM", { maximumFractionDigits: 0 });
    for (const n of [0, 25, 1000, 1234567]) {
      expect(money(n)).toBe(legacy(n));
    }
  });

  it("treats null/undefined/NaN amounts as zero", () => {
    expect(money(null)).toBe("K0");
    expect(money(undefined)).toBe("K0");
    expect(money(NaN)).toBe("K0");
  });

  it("accepts a group-config-like object", () => {
    expect(money(100, { currency: "ZMW" })).toBe("K100");
  });

  it("accepts a bare currency code string", () => {
    expect(money(100, "ZMW")).toBe("K100");
  });

  it("falls back to the ZMW default for an unrecognized currency code", () => {
    expect(money(100, "USD")).toBe("K100");
  });
});

describe("currencySymbol", () => {
  it("returns K for ZMW", () => {
    expect(currencySymbol("ZMW")).toBe("K");
  });

  it("falls back to the default symbol for an unrecognized code", () => {
    expect(currencySymbol("USD")).toBe(CURRENCY_DEFAULTS.symbol);
  });
});
