import { hashPin, verifyPin, isLegacyHash, randomSalt, newToken, hashToken, uid, generateGroupCode } from "./crypto.js";
import { HttpError } from "./httpError.js";
import { isSubscriptionActive, FREE_TIER_MAX_MEMBERS } from "./subscriptionUtils.js";
import { cleanText, cleanPhone, validatePin } from "./validation.js";
import { POLICIES, rateKey, clientIp, assertNotBlocked, recordFailure, clearFailures } from "./rateLimit.js";

export { HttpError };

const SESSION_TTL_HOURS = 24 * 7; // a week

// Shown for every login failure that could possibly mean "no such
// account" — unknown group code, unknown name/phone, removed account,
// or a wrong PIN all collapse into this one message. Telling any of
// those apart from the response would let an attacker enumerate real
// group codes or account names; the rate limiting below (loginIp,
// loginAccount, codeLookupIp — see rateLimit.js) is what actually keeps
// guessing slow, not the wording of the error.
const GENERIC_LOGIN_ERROR = "Incorrect name, phone number, or PIN.";

// Burns roughly the same CPU time as a real verifyPin() call (one
// PBKDF2 derive) on a path that has no real PIN to check — an unknown
// group code or unknown account — so the two cases aren't distinguishable
// by response latency either.
async function burnPinHashTime(pin) {
  await hashPin(pin, randomSalt());
}

// A session token is returned to the client once; only its SHA-256 hash
// is stored (see hashToken in crypto.js), so a copy of the database or a
// backup can't be replayed as a login.
async function insertSession(env, userId, token) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  return env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(await hashToken(token), userId, expiresAt);
}

export async function logoutSession(env, token) {
  if (!token) return;
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(await hashToken(token)).run();
}

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
    `SELECT s.expires_at, u.id, u.display_name, u.role, u.active, u.title, u.gender,
            u.group_id as groupId, g.slug as groupSlug, g.group_name as groupName,
            g.suspended_at as groupSuspendedAt
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN groups g ON g.id = u.group_id
     WHERE s.token = ?`
  ).bind(await hashToken(token)).first();

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
    title: row.title || null,
    gender: row.gender || null,
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

// Optional, self-reported form of address, used only for greeting
// phrasing (see dashboardMath.js's titledAddress()) — never gates
// anything, so an omitted or empty value just means "no preference,"
// not an error. Kept in its own `title` column, deliberately separate
// from `gender` below — this used to be folded into the gender column
// (pre-migration 024), which meant picking "Dr" was validated as if it
// were a gender and could fail with a "gender" error for a field the
// user never saw labeled that way. Rejects anything outside this list
// rather than silently storing free text, since titledAddress() only
// knows how to render exactly these options.
const VALID_TITLE_VALUES = ["sister", "brother", "mrs", "mr", "ms", "dr", "father", "madame"];
export function normalizeTitle(title) {
  if (title === undefined || title === null || title === "") return null;
  if (!VALID_TITLE_VALUES.includes(title)) {
    throw new HttpError(400, `Title must be one of: ${VALID_TITLE_VALUES.join(", ")} (or left unset).`);
  }
  return title;
}

// True gender — strictly separate from the title/address field above,
// and never inferred from it. Nothing in the UI currently collects this
// (no form has a real gender selector), so it's normally omitted/null;
// kept validated for whatever does eventually set it explicitly.
const VALID_GENDER_VALUES = ["male", "female"];
export function normalizeGender(gender) {
  if (gender === undefined || gender === null || gender === "") return null;
  if (!VALID_GENDER_VALUES.includes(gender)) {
    throw new HttpError(400, `Gender must be 'male' or 'female' (or left unset).`);
  }
  return gender;
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
// a per-account and per-IP lockout after repeated failures (rateLimit.js).
// Never creates an account (see joinGroup() below for that): the two are
// deliberately split so phone-number collection can't be skipped by using
// the "wrong" form — sign-in stays minimal and fast, sign-up is the only
// path onto the roster.
//
// Every failure path — unknown group code, unknown name/phone, a removed
// account, a wrong PIN — throws the exact same GENERIC_LOGIN_ERROR at the
// same roughly-constant cost (burnPinHashTime on the paths with no real
// PIN to check). None of this is observable from outside, by design: a
// distinct "no such account, sign up first" message is exactly the signal
// that lets an attacker enumerate real names or group codes.
export async function login(env, groupSlug, identifier, pin, request) {
  if (!identifier || !identifier.trim()) throw new HttpError(400, "Name or phone number is required.");
  if (!pin || pin.length < 4) throw new HttpError(400, "PIN must be at least 4 digits.");

  const ip = clientIp(request);
  const ipKey = await rateKey("login-ip", ip);
  const codeLookupKey = await rateKey("code-lookup-ip", ip);
  await assertNotBlocked(env, [ipKey, codeLookupKey]);

  let group;
  try {
    group = await resolveGroupBySlug(env, groupSlug);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      await recordFailure(env, codeLookupKey, POLICIES.codeLookupIp);
      await burnPinHashTime(pin);
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }
    throw e;
  }

  const key = identifier.trim().toLowerCase();
  const phoneKey = normalizePhone(identifier);

  let user = await env.DB.prepare(
    `SELECT * FROM users WHERE group_id = ? AND (name = ? OR (phone IS NOT NULL AND phone = ?))`
  ).bind(group.id, key, phoneKey).first();

  // Keyed by the resolved user id when the account exists, or by the
  // submitted identifier itself when it doesn't — so a nonexistent name
  // locks out exactly like a real one, and a 429 can never itself be used
  // to test whether an account exists.
  const acctKey = await rateKey("login-acct", group.id, user ? user.id : key);
  await assertNotBlocked(env, [ipKey, acctKey]);

  if (!user || !user.active) {
    await recordFailure(env, ipKey, POLICIES.loginIp);
    await recordFailure(env, acctKey, POLICIES.loginAccount);
    await burnPinHashTime(pin);
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  // An admin-reset account (see POST /api/admin/reset-pin) has its
  // pin_hash cleared to '' rather than the row being deleted — role,
  // name, and phone all stay intact, only the PIN needs setting again.
  // Whatever's submitted here becomes the account's new PIN, since
  // there's no old hash left to verify against.
  if (!user.pin_hash) {
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    await env.DB.prepare(`UPDATE users SET pin_salt = ?, pin_hash = ? WHERE id = ?`)
      .bind(salt, hash, user.id).run();
    user = { ...user, pin_salt: salt, pin_hash: hash };
  } else {
    const ok = await verifyPin(pin, user.pin_salt, user.pin_hash);
    if (!ok) {
      await recordFailure(env, ipKey, POLICIES.loginIp);
      await recordFailure(env, acctKey, POLICIES.loginAccount);
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

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

  // A correct PIN clears this account's own failure count — but not the
  // IP's. IP-level failures are about volume from that network, and
  // should keep decaying on their own (loginIp's decayMs) rather than
  // reset on every success, or one attacker-controlled account would
  // give unlimited free guesses against everyone else from the same IP.
  await clearFailures(env, acctKey);

  const token = newToken();
  await (await insertSession(env, user.id, token)).run();

  return {
    name: user.display_name,
    role: user.role,
    title: user.title || null,
    gender: user.gender || null,
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
export async function joinGroup(env, groupSlug, name, phone, pin, termsAccepted, title, gender, request) {
  // Counts every sign-up attempt against this IP, successful or not —
  // this is a volume cap on account creation, not a guessing lockout, so
  // it's recorded up front rather than only on failure.
  const ip = clientIp(request);
  const ipKey = await rateKey("join-ip", ip);
  const codeLookupKey = await rateKey("code-lookup-ip", ip);
  await assertNotBlocked(env, [ipKey, codeLookupKey]);
  await recordFailure(env, ipKey, POLICIES.joinIp);

  const cleanName = cleanText(name, { label: "Full name", max: 80 });
  const phoneKey = cleanPhone(phone);
  validatePin(pin);
  // Re-checked here, not just gated client-side (Login.jsx disables the
  // submit button until the checkbox is ticked) — the same "never trust
  // the client alone for something that matters" rule every other
  // validation in this file already follows.
  if (!termsAccepted) throw new HttpError(400, "You must accept the Terms & Conditions to continue.");
  const titleValue = normalizeTitle(title);
  const genderValue = normalizeGender(gender);

  let group;
  try {
    group = await resolveGroupBySlug(env, groupSlug);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) await recordFailure(env, codeLookupKey, POLICIES.codeLookupIp);
    throw e;
  }

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

  const key = cleanName.toLowerCase();

  const id = uid();
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const token = newToken();

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, phone, pin_salt, pin_hash, title, gender, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, group.id, key, cleanName, phoneKey, salt, hash, titleValue, genderValue),
      await insertSession(env, id, token),
    ]);
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE constraint failed")) {
      throw new HttpError(409, "That name or phone number is already registered in this group.");
    }
    throw e;
  }

  return {
    name: cleanName,
    role: "member",
    title: titleValue,
    gender: genderValue,
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
// Group codes are always system-generated, never admin-typed — a
// human-chosen code (an early group on this platform picked "0000")
// trades away the one thing that matters most for a shared login
// secret: not being guessable. generateGroupCode()'s alphabet (crypto.js)
// already excludes visually ambiguous characters, so this stays easy to
// read aloud and retype despite being random. A collision is astronomically
// unlikely (~1 billion possible codes) but checked and retried anyway,
// same caution as every other uniqueness check in this file.
const MAX_CODE_ATTEMPTS = 5;
async function generateUniqueGroupCode(env) {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const candidate = generateGroupCode();
    const existing = await env.DB.prepare(`SELECT id FROM groups WHERE slug = ?`).bind(candidate).first();
    if (!existing) return candidate;
  }
  throw new HttpError(500, "Could not generate a group code — please try again.");
}

export async function createGroup(env, { groupName, adminName, pin, phone, title, gender, createdIp, termsAccepted }) {
  // Every attempt counts, successful or not — spinning up many groups
  // from one IP is the abuse case this caps, not a guessing attack.
  const ipKey = await rateKey("create-group-ip", createdIp || "unknown");
  await assertNotBlocked(env, [ipKey]);
  await recordFailure(env, ipKey, POLICIES.createGroupIp);

  const cleanGroupName = cleanText(groupName, { label: "Group name", max: 100 });
  const cleanAdminName = cleanText(adminName, { label: "Your name", max: 80 });
  validatePin(pin);
  // Same re-check as joinGroup() above — creating a group also creates a
  // brand-new admin account, so it's a "new member/admin registering"
  // moment too, not just an existing admin's routine action.
  if (!termsAccepted) throw new HttpError(400, "You must accept the Terms & Conditions to continue.");
  const titleValue = normalizeTitle(title);
  const genderValue = normalizeGender(gender);

  const normalizedSlug = await generateUniqueGroupCode(env);

  const groupId = uid();
  const userId = uid();
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  const key = cleanAdminName.toLowerCase();
  const token = newToken();
  // Phone isn't required to create a group (unlike joinGroup — creating
  // a group is still a lighter-weight action) — but when it's given,
  // storing it here (same cleanPhone as joinGroup) both on the
  // admin's own account and on the group row is what lets the owner
  // dashboard's fraud signal (fraudSignals.js) notice the same person
  // spinning up several groups in a short window, not just the same IP.
  const normalizedPhone = phone ? cleanPhone(phone) : null;

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
      ).bind(groupId, normalizedSlug, cleanGroupName, createdIp || null, normalizedPhone),
      env.DB.prepare(
        `INSERT INTO users (id, group_id, name, display_name, phone, pin_salt, pin_hash, title, gender, role, terms_accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', datetime('now'))`
      ).bind(userId, groupId, key, cleanAdminName, normalizedPhone, salt, hash, titleValue, genderValue),
      await insertSession(env, userId, token),
    ]);
  } catch (e) {
    if (String(e?.message || e).includes("UNIQUE constraint failed")) {
      throw new HttpError(409, "Could not generate a group code — please try again.");
    }
    throw e;
  }

  return {
    name: cleanAdminName,
    role: "admin",
    title: titleValue,
    gender: genderValue,
    token,
    isNew: true,
    groupSlug: normalizedSlug,
    groupName: cleanGroupName,
  };
}
