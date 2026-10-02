/**
 * Server-side input validation. The frontend validates too, but a request
 * can be sent without the frontend, so every route re-checks here. All
 * helpers throw HttpError(400) with a user-safe message and return the
 * cleaned value.
 */
import { HttpError } from "./httpError.js";

export const MAX_AMOUNT = 10_000_000;

// Control characters other than tab/newline have no place in names or notes.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]");

export function cleanText(value, { label = "Value", min = 1, max = 200, multiline = false } = {}) {
  if (typeof value !== "string") throw new HttpError(400, `${label} is required.`);
  const text = value.trim();
  if (text.length < min) throw new HttpError(400, min <= 1 ? `${label} is required.` : `${label} is too short.`);
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  if (CONTROL_CHARS.test(text) || (!multiline && /[\r\n]/.test(text))) {
    throw new HttpError(400, `${label} contains characters that aren't allowed.`);
  }
  return text;
}

// Like cleanText, but absent/blank is fine and becomes "".
export function cleanOptionalText(value, opts = {}) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return "";
  return cleanText(value, { ...opts, min: 0 });
}

export function parseAmount(value, { label = "Amount", allowZero = false, max = MAX_AMOUNT } = {}) {
  const isNumeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  const n = isNumeric ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  if (allowZero ? n < 0 : n <= 0) {
    throw new HttpError(400, allowZero ? `${label} can't be negative.` : `${label} must be greater than zero.`);
  }
  if (n > max) throw new HttpError(400, `${label} is too large.`);
  return Math.round(n * 100) / 100;
}

export function parseIsoDate(value, label = "Date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  return value;
}

// Opaque identifiers the client echoes back (schedule row ids, payment ids).
export function cleanId(value, label = "Id") {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new HttpError(400, `${label} is invalid.`);
  }
  return value;
}

const PIN_MIN = 4;
const PIN_MAX = 64;
export function validatePin(pin, label = "PIN") {
  if (typeof pin !== "string" || pin.length < PIN_MIN || pin.length > PIN_MAX) {
    throw new HttpError(400, `${label} must be ${PIN_MIN} to ${PIN_MAX} characters.`);
  }
  return pin;
}

// Digits with an optional leading "+", 7-15 digits (E.164 maximum).
export function cleanPhone(value, label = "Phone number") {
  if (typeof value !== "string") throw new HttpError(400, `Enter a valid ${label.toLowerCase()}.`);
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || trimmed.length > 24) {
    throw new HttpError(400, `Enter a valid ${label.toLowerCase()}.`);
  }
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}
