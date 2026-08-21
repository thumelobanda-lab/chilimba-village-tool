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
import { hashPin, verifyPin, randomSalt, newToken } from "./crypto.js";
import { HttpError } from "./httpError.js";

const OWNER_SESSION_TTL_HOURS = 12; // shorter than a group session (24 * 7) —
// owner access is the most sensitive credential in this system, so it's
// deliberately made to re-authenticate more often rather than linger.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function getOwnerSessionUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT os.expires_at, o.id, o.email
     FROM owner_sessions os JOIN owners o ON o.id = os.owner_id
     WHERE os.token = ?`
  ).bind(token).first();

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
export async function ownerLogin(env, email, password) {
  if (!email || !email.trim()) throw new HttpError(400, "Email is required.");
  if (!password) throw new HttpError(400, "Password is required.");

  const key = email.trim().toLowerCase();
  const owner = await env.DB.prepare(`SELECT * FROM owners WHERE email = ?`).bind(key).first();
  // Same message whether the email doesn't exist or the password is
  // wrong — an owner-login endpoint is a much higher-value enumeration
  // target than a group's login, so this is deliberately less specific
  // than the group login()'s 404 (whose slug is already public, unlike
  // an owner's email).
  if (!owner) throw new HttpError(401, "Incorrect email or password.");

  if (owner.locked_until && new Date(owner.locked_until).getTime() > Date.now()) {
    throw new HttpError(429, "Too many attempts. Try again later.");
  }

  const ok = await verifyPin(password, owner.password_salt, owner.password_hash);
  if (!ok) {
    const attempts = (owner.failed_attempts || 0) + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
    await env.DB.prepare(`UPDATE owners SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
      .bind(attempts, lockedUntil, owner.id).run();
    throw new HttpError(401, "Incorrect email or password.");
  }
  await env.DB.prepare(`UPDATE owners SET failed_attempts = 0, locked_until = NULL WHERE id = ?`)
    .bind(owner.id).run();

  const token = newToken();
  const expiresAt = new Date(Date.now() + OWNER_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO owner_sessions (token, owner_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, owner.id, expiresAt).run();

  return { email: owner.email, token, expiresAt };
}

export async function ownerLogout(env, token) {
  if (token) await env.DB.prepare(`DELETE FROM owner_sessions WHERE token = ?`).bind(token).run();
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
