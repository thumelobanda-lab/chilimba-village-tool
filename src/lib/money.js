/**
 * Every group today is Zambian Kwacha — these defaults reproduce the
 * "K" + en-ZM formatting every component used to redefine locally,
 * byte-for-byte, so this refactor is behavior-preserving until a group
 * actually carries a non-ZMW currency (see migration 023).
 */
export const CURRENCY_DEFAULTS = { country: "ZM", currency: "ZMW", symbol: "K", locale: "en-ZM" };

const CURRENCY_SYMBOLS = { ZMW: "K" };

export function currencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode] || CURRENCY_DEFAULTS.symbol;
}

/**
 * @param {number} amount
 * @param {{currency?: string, locale?: string}|string|null|undefined} groupOrCurrency
 *   Accepts a group-config-like object (reads .currency), a bare currency
 *   code string, or nothing — every call site can pass whatever it
 *   already has in scope (a loaded config, a currency code, or omit it
 *   entirely) without destructuring first.
 */
export function money(amount, groupOrCurrency) {
  const currency =
    (typeof groupOrCurrency === "string" ? groupOrCurrency : groupOrCurrency?.currency) ||
    CURRENCY_DEFAULTS.currency;
  const locale = (typeof groupOrCurrency === "object" && groupOrCurrency?.locale) || CURRENCY_DEFAULTS.locale;
  return currencySymbol(currency) + (Number(amount) || 0).toLocaleString(locale, { maximumFractionDigits: 0 });
}
