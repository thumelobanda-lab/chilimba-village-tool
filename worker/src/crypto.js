const PBKDF2_ITERATIONS = 100000; // see the note below for how this was chosen
const PBKDF2_PREFIX = "pbkdf2";

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

/**
 * PIN hashing. A PIN is a 4-digit secret — only 10,000 possible values —
 * so a single fast hash (even salted) is the wrong tool: if the users
 * table were ever read by an attacker, SHA-256 computes fast enough that
 * every account's PIN could be brute-forced in under a second each. The
 * salt stops rainbow-table reuse across accounts but does nothing to
 * slow down attacking one specific hash, which is the actual threat here.
 *
 * PBKDF2-SHA256 makes each guess deliberately expensive instead. 100,000
 * iterations is the ceiling Cloudflare Workers' crypto.subtle.deriveBits
 * actually enforces for PBKDF2 (a higher count throws
 * NotSupportedError at call time, not a CPU-budget concern — this isn't
 * a tunable-for-performance number, it's the runtime's hard cap), and
 * still high enough to meaningfully slow bulk offline cracking while
 * keeping login fast for a real user (~tens of milliseconds). Stored as
 * `pbkdf2$<iterations>$<hex>` so the iteration count travels with the
 * hash and can be changed later without breaking older accounts.
 *
 * Accounts created before this change have a hash with no `pbkdf2$`
 * prefix — verifyPin() detects that and falls back to the old
 * single-round SHA-256 check. login() transparently re-hashes
 * with PBKDF2 the moment such an account logs in successfully, so every
 * account upgrades itself the first time its owner signs in again,
 * without anyone needing to reset a PIN.
 */
export async function hashPin(pin, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations },
    keyMaterial,
    256
  );
  return `${PBKDF2_PREFIX}$${iterations}$${bufToHex(bits)}`;
}

// The pre-PBKDF2 scheme — kept only so existing accounts can still log
// in. Never used for a new hash.
async function hashPinLegacySha256(pin, salt) {
  const enc = new TextEncoder().encode(salt + ":" + pin);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return bufToHex(digest);
}

export function isLegacyHash(storedHash) {
  return !storedHash.startsWith(`${PBKDF2_PREFIX}$`);
}

export async function verifyPin(pin, salt, storedHash) {
  if (isLegacyHash(storedHash)) {
    const legacy = await hashPinLegacySha256(pin, salt);
    return legacy === storedHash;
  }
  const [, iterationsStr] = storedHash.split("$");
  const candidate = await hashPin(pin, salt, Number(iterationsStr));
  return candidate === storedHash;
}

export function newToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

export function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return "***";
  return "*".repeat(digits.length - 3) + digits.slice(-3);
}

export function uid() {
  return crypto.randomUUID();
}
