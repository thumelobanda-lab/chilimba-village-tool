import { hashPin, verifyPin, isLegacyHash, randomSalt, newToken, uid } from "./crypto.js";
import { HttpError } from "./httpError.js";

export { HttpError };

const SESSION_TTL_HOURS = 24 * 7; // a week
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Resolves the authenticated user AND their group in one lookup. Every
 * route that touches group-scoped data (schedule, payments, funds,
 * loans, reminders...) uses user.groupId from here — never a group id
 * or slug supplied by the request. That's the one invariant that keeps
 * one tenant's data from leaking into another's response.
 */
export async function getSessionUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id, u.display_name, u.role, u.active, u.group_id as groupId, g.slug as groupSlug
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN groups g ON g.id = u.group_id
     WHERE s.token = ?`
  ).bind(token).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  // Checked on every request, not just at login — if an admin removes
  // this member while they're mid-session, access is revoked immediately
  // rather than lingering until their token naturally expires.
  if (!row.active) return null;

  return { id: row.id, name: row.display_name, role: row.role, groupId: row.groupId, groupSlug: row.groupSlug, token };
}

export async function requireSession(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError(401, "Not signed in.");
  return user;
}

export async function requireAdmin(request, env) {
  const user = await requireSession(request, env);
  if (user.role !== "admin") throw new HttpError(403, "Admin access required.");
  return user;
}

/**
 * Looks up a group by its login slug. Thrown as a 404 rather than a
 * generic error so the frontend can show "unknown group" distinctly from
 * "wrong PIN" — the slug is public info (like a company subdomain), so
 * this isn't an enumeration risk worth hiding behind a generic error.
 */
export async function resolveGroupBySlug(env, slug) {
  if (!slug || !slug.trim()) throw new HttpError(400, "Group code is required.");
  const group = await env.DB.prepare(`SELECT id, slug, group_name as groupName FROM groups WHERE slug = ?`)
    .bind(slug.trim().toLowerCase()).first();
  if (!group) throw new HttpError(404, "Unknown group code.");
  return group;
}

// Handles first-time signup (sets PIN) and subsequent logins (verifies PIN),
// with a per-account lockout after repeated failures — mitigates PIN
// guessing since a 4-digit PIN space is small. Name uniqueness is scoped
// to the group (WHERE group_id = ? AND name = ?), not global — the same
// name can exist in two different groups as two separate accounts.
export async function loginOrCreate(env, groupSlug, name, pin) {
  if (!pin || pin.length < 4) throw new HttpError(400, "PIN must be at least 4 digits.");

  const group = await resolveGroupBySlug(env, groupSlug);
  const key = name.trim().toLowerCase();
  let user = await env.DB.prepare(`SELECT * FROM users WHERE group_id = ? AND name = ?`)
    .bind(group.id, key).first();
  const isNew = !user;
  // An admin-reset account (see POST /api/admin/reset-pin) has its
  // pin_hash cleared to '' rather than the row being deleted — role,
  // display name, and payment history all stay intact, only the PIN
  // itself needs setting again. Treated the same as a brand-new signup
  // for this one login: whatever PIN is submitted here becomes the
  // account's new PIN, since there's no old hash left to verify against.
  const needsPinSet = isNew || !user.pin_hash;

  if (needsPinSet) {
    if (user && !user.active) throw new HttpError(403, "This account has been removed by an admin.");
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    if (isNew) {
      const id = uid();
      await env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, pin_salt, pin_hash) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, group.id, key, name.trim(), salt, hash).run();
      user = { id, group_id: group.id, name: key, display_name: name.trim(), role: "member" };
    } else {
      await env.DB.prepare(
        `UPDATE users SET pin_salt = ?, pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?`
      ).bind(salt, hash, user.id).run();
      user = { ...user, pin_salt: salt, pin_hash: hash };
    }
  } else {
    if (!user.active) {
      throw new HttpError(403, "This account has been removed by an admin.");
    }
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      throw new HttpError(429, "Too many attempts. Try again later.");
    }
    const ok = await verifyPin(pin, user.pin_salt, user.pin_hash);
    if (!ok) {
      const attempts = (user.failed_attempts || 0) + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null;
      await env.DB.prepare(`UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`)
        .bind(attempts, lockedUntil, user.id).run();
      throw new HttpError(401, "Incorrect PIN for this name.");
    }
    await env.DB.prepare(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`)
      .bind(user.id).run();

    // Transparent hash upgrade: an account created before the PBKDF2
    // switch verifies fine via the legacy path above, but a correct PIN
    // is the one moment we can safely re-hash it with the stronger
    // scheme — the member never sees this happen, and never needs to
    // reset anything.
    if (isLegacyHash(user.pin_hash)) {
      const upgraded = await hashPin(pin, user.pin_salt);
      await env.DB.prepare(`UPDATE users SET pin_hash = ? WHERE id = ?`).bind(upgraded, user.id).run();
    }
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(token, user.id, expiresAt).run();

  return {
    name: user.display_name,
    role: user.role,
    token,
    isNew,
    groupSlug: group.slug,
    groupName: group.groupName,
  };
}

/**
 * Creates a new group AND its first admin account in one step — there's
 * no platform superadmin to bootstrap an otherwise-empty group, so
 * whoever creates the group becomes its first admin automatically. This
 * is the only way to become the FIRST admin of a group; promoting an
 * admin for a group that already exists is self-service too (any
 * existing admin can promote a member — see /api/admin/promote in
 * routes/admin.js), never requiring database access anymore.
 */
export async function createGroup(env, { slug, groupName, adminName, pin }) {
  if (!slug || !slug.trim()) throw new HttpError(400, "Group code is required.");
  if (!groupName || !groupName.trim()) throw new HttpError(400, "Group name is required.");
  if (!adminName || !adminName.trim()) throw new HttpError(400, "Your name is required.");
  if (!pin || pin.length < 4) throw new HttpError(400, "Choose a PIN of at least 4 digits.");

  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
  const existing = await env.DB.prepare(`SELECT id FROM groups WHERE slug = ?`).bind(normalizedSlug).first();
  if (existing) throw new HttpError(409, "That group code is already taken.");

  const groupId = uid();
  const userId = uid();
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const key = adminName.trim().toLowerCase();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // The group, its first admin, and their session must land together or
  // not at all — batch() runs them as one D1 transaction, same pattern
  // as the multi-write mutations elsewhere (contributions.js, admin.js,
  // subscription.js). Previously these were three separate awaited
  // .run() calls: if the request got interrupted between them (e.g. the
  // client disconnecting mid-request — Cloudflare Workers can abort
  // in-flight execution when that happens), the group row could commit
  // with no admin ever created for it. That group then permanently
  // squats its slug — every future attempt at the same code correctly
  // gets 409'd against a group nobody can actually log into. A UNIQUE
  // constraint failure on slug (two concurrent creates for the same
  // code racing past the check above) is caught and reported as the
  // same clean 409, instead of leaking as a raw D1 error.
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO groups (id, slug, group_name, cycle_name, recipient_exempt, schedule_json, funds_json)
         VALUES (?, ?, ?, 'Cycle 1', 1, '[]', '[]')`
      ).bind(groupId, normalizedSlug, groupName.trim()),
      env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, pin_salt, pin_hash, role) VALUES (?, ?, ?, ?, ?, ?, 'admin')`
      ).bind(userId, groupId, key, adminName.trim(), salt, hash),
      env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
        .bind(token, userId, expiresAt),
    ]);
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE constraint failed")) {
      throw new HttpError(409, "That group code is already taken.");
    }
    throw e;
  }

  return {
    name: adminName.trim(),
    role: "admin",
    token,
    isNew: true,
    groupSlug: normalizedSlug,
    groupName: groupName.trim(),
  };
}
