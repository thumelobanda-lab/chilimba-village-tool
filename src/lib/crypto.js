/**
 * Small Web Crypto helpers — used so PINs are never stored or compared
 * in plain text, even in mock/local mode.
 */

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export async function hashPin(pin, salt) {
  const enc = new TextEncoder().encode(salt + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return bufToHex(digest);
}

export async function verifyPin(pin, salt, storedHash) {
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}

// Mask a phone number for display/storage — keep only the last 3 digits.
export function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return "***";
  return "*".repeat(digits.length - 3) + digits.slice(-3);
}
