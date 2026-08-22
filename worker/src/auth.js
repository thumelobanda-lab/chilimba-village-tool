import { hashPin, verifyPin, isLegacyHash, randomSalt, newToken, uid } from "./crypto.js";
import { HttpError } from "./httpError.js";
import { isSubscriptionActive, FREE_TIER_MAX_MEMBERS } from "./subscriptionUtils.js";

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
    `SELECT s.expires_at, u.id, u.display_name, u.role, u.active,
            u.group_id as groupId, g.slug as groupSlug, g.group_name as groupName,
            g.suspended_at as groupSuspendedAt
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN groups g ON g.id = u.group_id
     WHERE s.token = ?`
  ).bind(token).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  // Checked on every request, not just at login — if an admin removes
  // this member while they're mid-session, access is revoked immediately
  // rather than lingering until their token naturally expires. The same
  // freshness is why GET /api/me (routes/profile.js) exists: role here
  // is read from `users` on every call, never cached on the token, so a
  // promotion is already correct server-side the instant it happens —
  // /api/me just lets the frontend catch up its own stale session state.
  if (!row.active) return null;
  // A platform owner suspending a group (routes/owner.js) also deletes
  // every session for it, but this is the second, ongoing half of that:
  // it stops a NEW session — one that already existed elsewhere, or one
  // issued in the instant between the suspend and its DELETE — from
  // getting in either. A distinct error, not the generic 401, so the
  // frontend can show what actually happened instead of "sign in again".
  if (row.groupSuspendedAt) throw new HttpError(403, "This group has been suspended. Contact support.");

  return {
    id: row.id,
    name: row.display_name,
    role: row.role,
    groupId: row.groupId,
    groupSlug: row.groupSlug,
    groupName: row.groupName,
    token,
  };
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
  const group = await env.DB.prepare(
    `SELECT id, slug, group_name as groupName, subscription_expires_at as subscriptionExpiresAt, suspended_at as suspendedAt
     FROM groups WHERE slug = ?`
  ).bind(slug.trim().toLowerCase()).first();
  if (!group) throw new HttpError(404, "Unknown group code.");
  if (group.suspendedAt) throw new HttpError(403, "This group has been suspended. Contact support.");
  return group;
}

// Strips everything but digits (and a leading "+", if given) so
// equivalent formats ("097 123 4567", "097-123-4567", "+260971234567")
// compare and store consistently.
function normalizePhone(phone) {
  const trimmed = (phone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

// Sign in only — an EXISTING account's name or phone number + PIN, with
// a per-account lockout after repeated failures. Never creates an
// account (see joinGroup() below for that): the two are deliberately
// split so phone-number collection can't be skipped by using the "wrong"
// form — sign-in stays minimal and fast, sign-up is the only path onto
// the roster. A not-found identifier is a clear 404 pointing at sign-up,
// not a silent registration.
export async function login(env, groupSlug, identifier, pin) {
  if (!identifier || !identifier.trim()) throw new HttpError(400, "Name or phone number is required.");
  if (!pin || pin.length < 4) throw new HttpError(400, "PIN must be at least 4 digits.");

  const group = await resolveGroupBySlug(env, groupSlug);
  const key = identifier.trim().toLowerCase();
  const phoneKey = normalizePhone(identifier);

  let user = await env.DB.prepare(
    `SELECT * FROM users WHERE group_id = ? AND (name = ? OR (phone IS NOT NULL AND phone = ?))`
  ).bind(group.id, key, phoneKey).first();
  if (!user) throw new HttpError(404, "No account found with that name or phone number — sign up first.");
  if (!user.active) throw new HttpError(403, "This account has been removed by an admin.");

  // An admin-reset account (see POST /api/admin/reset-pin) has its
  // pin_hash cleared to '' rather than the row being deleted — role,
  // name, and phone all stay intact, only the PIN needs setting again.
  // Whatever's submitted here becomes the account's new PIN, since
  // there's no old hash left to verify against.
  if (!user.pin_hash) {
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    await env.DB.prepare(
      `UPDATE users SET pin_salt = ?, pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?`
    ).bind(salt, hash, user.id).run();
    user = { ...user, pin_salt: salt, pin_hash: hash };
  } else {
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
      throw new HttpError(401, "Incorrect PIN.");
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
    isNew: false,
    groupSlug: group.slug,
    groupName: group.groupName,
  };
}

// Creates a brand-new member account — the only place a phone number
// gets collected, so it's reliably on file for every member going
// forward (existing accounts predate this column and have none — see
// migration 006). Both name and phone are unique WITHIN the group, not
// globally, matching how name uniqueness already worked: the same
// person can be a genuinely separate member of a different group. The
// user insert and session insert land together via batch() or not at
// all — same reasoning as createGroup() below (a failure between two
// separate writes here previously risked an orphaned account with no
// session, on a much smaller scale than that bug, but the same fix).
export async function joinGroup(env, groupSlug, name, phone, pin, termsAccepted) {
  if (!name || !name.trim()) throw new HttpError(400, "Full name is required.");
  const phoneKey = normalizePhone(phone);
  if (phoneKey.replace(/^\+/, "").length < 7) throw new HttpError(400, "Enter a valid phone number.");
  if (!pin || pin.length < 4) throw new HttpError(400, "Choose a PIN of at least 4 digits.");
  // Re-checked here, not just gated client-side (Login.jsx disables the
  // submit button until the checkbox is ticked) — the same "never trust
  // the client alone for something that matters" rule every other
  // validation in this file already follows.
  if (!termsAccepted) throw new HttpError(400, "You must accept the Terms & Conditions to continue.");

  const group = await resolveGroupBySlug(env, groupSlug);

  // Free tier's member cap — checked here, where membership is actually
  // granted, not just displayed somewhere in the UI (a determined free
  // tier group could otherwise just skip past a client-side warning).
  // Premium groups (a real, confirmed subscription — see
  // subscriptionUtils.js) have no cap at all.
  if (!isSubscriptionActive(group.subscriptionExpiresAt)) {
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM users WHERE group_id = ? AND active = 1`
    ).bind(group.id).first();
    if ((countRow?.count || 0) >= FREE_TIER_MAX_MEMBERS) {
      throw new HttpError(
        402,
        `This group is on the free plan (max ${FREE_TIER_MAX_MEMBERS} members) — ask an admin to upgrade to add more.`
      );
    }
  }

  const key = name.trim().toLowerCase();

  const id = uid();
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, phone, pin_salt, pin_hash, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, group.id, key, name.trim(), phoneKey, salt, hash),
      env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
        .bind(token, id, expiresAt),
    ]);
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE constraint failed")) {
      throw new HttpError(409, "That name or phone number is already registered in this group.");
    }
    throw e;
  }

  return {
    name: name.trim(),
    role: "member",
    token,
    isNew: true,
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
export async function createGroup(env, { slug, groupName, adminName, pin, phone, createdIp, termsAccepted }) {
  if (!slug || !slug.trim()) throw new HttpError(400, "Group code is required.");
  if (!groupName || !groupName.trim()) throw new HttpError(400, "Group name is required.");
  if (!adminName || !adminName.trim()) throw new HttpError(400, "Your name is required.");
  if (!pin || pin.length < 4) throw new HttpError(400, "Choose a PIN of at least 4 digits.");
  // Same re-check as joinGroup() above — creating a group also creates a
  // brand-new admin account, so it's a "new member/admin registering"
  // moment too, not just an existing admin's routine action.
  if (!termsAccepted) throw new HttpError(400, "You must accept the Terms & Conditions to continue.");

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
  // Phone isn't required to create a group (unlike joinGroup — creating
  // a group is still a lighter-weight action) — but when it's given,
  // storing it here (same normalizePhone as joinGroup) both on the
  // admin's own account and on the group row is what lets the owner
  // dashboard's fraud signal (fraudSignals.js) notice the same person
  // spinning up several groups in a short window, not just the same IP.
  const normalizedPhone = phone ? normalizePhone(phone) : null;

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
        `INSERT INTO groups (id, slug, group_name, cycle_name, recipient_exempt, schedule_json, funds_json, created_ip, created_by_phone)
         VALUES (?, ?, ?, 'Cycle 1', 1, '[]', '[]', ?, ?)`
      ).bind(groupId, normalizedSlug, groupName.trim(), createdIp || null, normalizedPhone),
      env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, phone, pin_salt, pin_hash, role, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', datetime('now'))`
      ).bind(userId, groupId, key, adminName.trim(), normalizedPhone, salt, hash),
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
