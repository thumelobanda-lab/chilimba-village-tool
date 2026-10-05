/**
 * Platform-owner authentication — deliberately NOT part of auth.js.
 * Owner sessions live in owner_sessions, a table with no relationship
 * to `sessions` (group-member/admin tokens) beyond both being TEXT
 * primary keys — different table, different token space. requireOwner()
 * below only ever queries owner_sessions, so a token lifted from a
 * compromised group-admin account has literally nothing to look up here;
 * there's no shared code path or shared row that a bug could confuse.
 *
 * There is deliberately no HTTP endpoint that creates an owner account —
 * see scripts/create-owner.sh, which writes the first (and any later)
 * owner row directly via `wrangler d1 execute`. That requires real
 * Cloudflare account access, a materially stronger bar than any HTTP
 * request could be gated behind, and rules out a self-service or
 * leaked-secret path to owner access entirely.
 */
import { hashPin, verifyPin, randomSalt, newToken, hashToken } from "./crypto.js";
import { HttpError } from "./httpError.js";
import { POLICIES, rateKey, clientIp, assertNotBlocked, recordFailure, clearFailures } from "./rateLimit.js";

const OWNER_SESSION_TTL_HOURS = 12; // shorter than a group session (24 * 7) —
// owner access is the most sensitive credential in this system, so it's
// deliberately made to re-authenticate more often rather than linger.

export async function getOwnerSessionUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT os.expires_at, o.id, o.email
     FROM owner_sessions os JOIN owners o ON o.id = os.owner_id
     WHERE os.token = ?`
  ).bind(await hashToken(token)).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return { id: row.id, email: row.email, token };
}

export async function requireOwner(request, env) {
  const owner = await getOwnerSessionUser(request, env);
  if (!owner) throw new HttpError(401, "Not signed in as owner.");
  return owner;
}

// Same PBKDF2-SHA256 primitive as PIN hashing (crypto.js) — hashPin/
// verifyPin are generic secret hashers despite the name; a real
// password gives them far more entropy to work with than a 4-digit PIN
// ever could, so reusing them (rather than a separate scheme) is a
// strict improvement, not a compromise.
export async function ownerLogin(env, email, password, request) {
  if (!email || !email.trim()) throw new HttpError(400, "Email is required.");
  if (!password) throw new HttpError(400, "Password is required.");

  const key = email.trim().toLowerCase();
  const ip = clientIp(request);
  const ipKey = await rateKey("owner-ip", ip);
  // Keyed by the submitted email, found or not — same reasoning as the
  // group login()'s per-account key: an unknown email must lock out
  // exactly like a real one, or the lockout itself becomes the leak.
  const acctKey = await rateKey("owner-acct", key);
  await assertNotBlocked(env, [ipKey, acctKey]);

  const owner = await env.DB.prepare(`SELECT * FROM owners WHERE email = ?`).bind(key).first();
  // Same message and (via the dummy hash below) similar cost whether the
  // email doesn't exist or the password is wrong — an owner-login endpoint
  // is a much higher-value enumeration target than a group's login.
  if (!owner) {
    await recordFailure(env, ipKey, POLICIES.ownerIp);
    await recordFailure(env, acctKey, POLICIES.ownerAccount);
    await hashPin(password, randomSalt());
    throw new HttpError(401, "Incorrect email or password.");
  }

  const ok = await verifyPin(password, owner.password_salt, owner.password_hash);
  if (!ok) {
    await recordFailure(env, ipKey, POLICIES.ownerIp);
    await recordFailure(env, acctKey, POLICIES.ownerAccount);
    throw new HttpError(401, "Incorrect email or password.");
  }
  await clearFailures(env, acctKey);

  const token = newToken();
  const expiresAt = new Date(Date.now() + OWNER_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO owner_sessions (token, owner_id, expires_at) VALUES (?, ?, ?)`)
    .bind(await hashToken(token), owner.id, expiresAt).run();

  return { email: owner.email, token, expiresAt };
}

export async function ownerLogout(env, token) {
  if (token) await env.DB.prepare(`DELETE FROM owner_sessions WHERE token = ?`).bind(await hashToken(token)).run();
}

// Exported for scripts/create-owner.mjs's own reference/documentation
// only — the script duplicates this hashing inline rather than
// importing across the worker/root package boundary; kept here so the
// two never silently drift (see that script's header comment).
export async function hashOwnerPassword(password) {
  const salt = randomSalt();
  const hash = await hashPin(password, salt);
  return { salt, hash };
}
