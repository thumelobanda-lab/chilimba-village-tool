// Mirrors src/lib/money.js — frontend and worker are separate npm
// packages with no shared import boundary, so this is duplicated on
// purpose (same pattern as normalizeGender in this file vs.
// src/lib/api/auth.js). Every group today is Zambian Kwacha; these
// defaults reproduce the "K" + en-ZM formatting every call site used to
// build inline, byte-for-byte, so this is behavior-preserving until a
// group actually carries a non-ZMW currency (see migration 023).
export const CURRENCY_DEFAULTS = { country: "ZM", currency: "ZMW", symbol: "K", locale: "en-ZM" };

const CURRENCY_SYMBOLS = { ZMW: "K" };

export function currencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode] || CURRENCY_DEFAULTS.symbol;
}

export function money(amount, groupOrCurrency) {
  const currency =
    (typeof groupOrCurrency === "string" ? groupOrCurrency : groupOrCurrency?.currency) ||
    CURRENCY_DEFAULTS.currency;
  const locale = (typeof groupOrCurrency === "object" && groupOrCurrency?.locale) || CURRENCY_DEFAULTS.locale;
  return currencySymbol(currency) + (Number(amount) || 0).toLocaleString(locale, { maximumFractionDigits: 0 });
}
