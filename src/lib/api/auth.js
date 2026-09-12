import { randomSalt, hashPin, verifyPin, generateGroupCode } from "../crypto.js";
import { isAdminName } from "../adminConfig.js";
import { MOCK_MODE, lsGet, lsSet, realFetch } from "./core.js";
import { FREE_TIER_MAX_MEMBERS } from "./subscription.js";

// Every group's data — schedule, funds, and every account — is scoped by
// its slug (e.g. "hillcrest"). This mirrors the real backend's model:
// two different groups can each have their own "Harriet" as two
// completely separate accounts. Mock-mode storage keys below all include
// the slug for exactly this reason — without it, testing two groups in
// the same browser would silently merge their data.
function normalizeSlug(slug) {
  return (slug || "").trim().toLowerCase().replace(/\s+/g, "-");
}
function accountKey(slug, name) {
  return `chilimba:account:${normalizeSlug(slug)}:${name.trim().toLowerCase()}`;
}
function groupKey(slug) {
  return `chilimba:group:${normalizeSlug(slug)}`;
}
// Strips everything but digits (and a leading "+", if given) so
// equivalent formats compare and store consistently — mirrors
// normalizePhone() in worker/src/auth.js.
function normalizePhone(phone) {
  const trimmed = (phone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

// Mirrors normalizeGender() in worker/src/auth.js — optional, greeting-
// phrasing-only (see dashboardMath.js's genderedAddress), so an omitted
// value is fine but an unrecognized one isn't silently stored as free
// text.
function normalizeGender(gender) {
  if (gender === undefined || gender === null || gender === "") return null;
  if (gender !== "male" && gender !== "female") {
    throw new Error("Gender must be 'male' or 'female' (or left unset).");
  }
  return gender;
}

// Mock mode has no separate phone-indexed lookup table — accounts are
// keyed by name — so finding one by phone means scanning this group's
// accounts, same approach getGroupMembers() (members.js) already uses
// for "every account in this group".
function findAccountByPhone(slug, phoneKey) {
  if (!phoneKey) return null;
  const prefix = `chilimba:account:${normalizeSlug(slug)}:`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const account = lsGet(key, null);
    if (account && account.phone === phoneKey) return { key, account };
  }
  return null;
}

// Sign in only — an EXISTING account's name or phone number + PIN.
// Never creates an account; see join() below for that. The split
// mirrors the real backend (worker/src/auth.js) so "sign up" is the
// only path that ever asks for a phone number.
export async function login(groupSlug, identifier, pin) {
  if (MOCK_MODE) {
    if (!identifier || !identifier.trim()) throw new Error("Name or phone number is required.");
    if (!pin || pin.length < 4) throw new Error("Choose a PIN of at least 4 digits.");
    const slug = normalizeSlug(groupSlug);
    if (!slug) throw new Error("Group code is required.");
    const group = lsGet(groupKey(slug), null);
    if (!group) throw new Error("Unknown group code.");

    const byName = { key: accountKey(slug, identifier), account: lsGet(accountKey(slug, identifier), null) };
    const matchedByName = !!byName.account;
    const found = matchedByName ? byName : findAccountByPhone(slug, normalizePhone(identifier));
    if (!found || !found.account) throw new Error("No account found with that name or phone number — sign up first.");

    const { key, account: existing } = found;
    if (existing.active === false) throw new Error("This account has been removed by an admin.");

    // An admin-reset account (see resetMemberPin in members.js) has its
    // hash/salt cleared rather than being deleted — treated the same as
    // a brand-new signup for PIN purposes: whatever's typed here becomes
    // the new PIN, since there's no old one left to verify against.
    if (!existing.hash) {
      const salt = randomSalt();
      const hash = await hashPin(pin, salt);
      lsSet(key, { ...existing, salt, hash });
    } else {
      const ok = await verifyPin(pin, existing.salt, existing.hash);
      if (!ok) throw new Error("Incorrect PIN.");
    }

    // Preserve whatever casing was just typed when they signed in by
    // name (matches the account's own name anyway, case-insensitively)
    // — but signing in by phone number shouldn't rename the session to
    // a phone number, so that case falls back to the account's stored
    // display name (or, for an older mock account from before that was
    // recorded, the lowercase key as a last resort).
    const fallbackName = key.slice(`chilimba:account:${slug}:`.length);
    const sessionName = matchedByName ? identifier.trim() : existing.displayName || fallbackName;

    const session = {
      name: sessionName,
      role: existing.role,
      gender: existing.gender || null,
      groupSlug: slug,
      groupName: group.groupName,
      token: `mock-${Date.now()}`,
    };
    lsSet("chilimba:session", session);
    return { ...session, isNew: false };
  }

  return realFetch("/api/login", { method: "POST", body: JSON.stringify({ groupSlug, identifier, pin }) }).then(
    (session) => {
      // Persist the session the same way the mock branch does — realFetch()
      // (used by every other API call) reads the token back out of this
      // exact key. Without this line, login looks like it succeeds but
      // every subsequent request silently goes out with no Authorization
      // header and gets rejected, and a page reload logs the member out.
      const { isNew, ...toPersist } = session;
      lsSet("chilimba:session", toPersist);
      return session;
    }
  );
}

// Creates a brand-new member account — full name and phone number are
// both required (see joinGroup() in worker/src/auth.js for why phone is
// collected here and nowhere else). Both are unique WITHIN the group.
// termsAccepted mirrors the server-side check in joinGroup() — checked
// here too so mock mode enforces the same rule real users hit, not just
// the Login.jsx checkbox disabling the submit button.
export async function join(groupSlug, name, phone, pin, termsAccepted, gender) {
  if (!name || !name.trim()) throw new Error("Full name is required.");
  const phoneKey = normalizePhone(phone);
  if (phoneKey.replace(/^\+/, "").length < 7) throw new Error("Enter a valid phone number.");
  if (!pin || pin.length < 4) throw new Error("Choose a PIN of at least 4 digits.");
  if (!termsAccepted) throw new Error("You must accept the Terms & Conditions to continue.");
  const genderValue = normalizeGender(gender);

  if (MOCK_MODE) {
    const slug = normalizeSlug(groupSlug);
    if (!slug) throw new Error("Group code is required.");
    const group = lsGet(groupKey(slug), null);
    if (!group) throw new Error("Unknown group code.");

    const key = accountKey(slug, name);
    if (lsGet(key, null)) throw new Error("That name is already registered in this group.");
    if (findAccountByPhone(slug, phoneKey)) throw new Error("That phone number is already registered in this group.");

    // Free tier's member cap — mirrors the check in worker/src/auth.js's
    // joinGroup(), so mock mode behaves the same way once a browser has
    // 8 active mock accounts for a group with no active subscription.
    const sub = lsGet(["chilimba", "group-sub", slug].join(":"), null);
    const subActive = !!(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
    if (!subActive) {
      const prefix = `chilimba:account:${slug}:`;
      let activeCount = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix)) continue;
        const acc = lsGet(k, null);
        if (acc && acc.active !== false) activeCount++;
      }
      if (activeCount >= FREE_TIER_MAX_MEMBERS) {
        throw new Error(`This group is on the free plan (max ${FREE_TIER_MAX_MEMBERS} members) — ask an admin to upgrade to add more.`);
      }
    }

    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    // adminConfig.js is a mock-only developer shortcut for quick local
    // testing — the real backend has no equivalent; there, the only way
    // to become an admin is creating the group or a direct database
    // write. Kept here so a solo dev testing locally doesn't have to
    // reproduce the create-group flow just to reach the admin-only tabs.
    const role = isAdminName(name) ? "admin" : "member";
    lsSet(key, {
      salt, hash, role, phone: phoneKey, gender: genderValue, displayName: name.trim(), active: true,
      joinedAt: new Date().toISOString(), termsAcceptedAt: new Date().toISOString(),
    });

    const session = {
      name: name.trim(),
      role,
      gender: genderValue,
      groupSlug: slug,
      groupName: group.groupName,
      token: `mock-${Date.now()}`,
    };
    lsSet("chilimba:session", session);
    return { ...session, isNew: true };
  }

  return realFetch("/api/join", { method: "POST", body: JSON.stringify({ groupSlug, name, phone, pin, termsAccepted, gender }) }).then(
    (session) => {
      const { isNew, ...toPersist } = session;
      lsSet("chilimba:session", toPersist);
      return session;
    }
  );
}

// Creates a brand-new group AND its first admin account in one step —
// there's no platform superadmin to bootstrap an otherwise-empty group,
// so whoever creates it becomes its admin automatically. This is the
// ONLY self-service way to become an admin; every other promotion still
// requires a direct database write (see schema.sql), which stays true
// for groups that already exist.
// Generates its own unique code rather than taking one from the caller
// — same reasoning as the real backend's generateUniqueGroupCode
// (worker/src/auth.js): a human-chosen code trades away the one thing
// that matters for a shared login secret, being hard to guess.
function generateUniqueGroupCode() {
  const MAX_ATTEMPTS = 5;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = generateGroupCode();
    if (!lsGet(groupKey(candidate), null)) return candidate;
  }
  throw new Error("Could not generate a group code — please try again.");
}

export async function createGroup({ groupName, adminName, pin, termsAccepted, gender }) {
  if (!groupName || !groupName.trim()) throw new Error("Group name is required.");
  if (!adminName || !adminName.trim()) throw new Error("Your name is required.");
  if (!pin || pin.length < 4) throw new Error("Choose a PIN of at least 4 digits.");
  if (!termsAccepted) throw new Error("You must accept the Terms & Conditions to continue.");
  const genderValue = normalizeGender(gender);

  if (MOCK_MODE) {
    const normalizedSlug = generateUniqueGroupCode();

    lsSet(groupKey(normalizedSlug), {
      groupName: groupName.trim(),
      cycleName: "Cycle 1",
      recipientExempt: true,
      schedule: [],
      funds: [],
    });

    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    lsSet(accountKey(normalizedSlug, adminName), {
      salt, hash, role: "admin", gender: genderValue, active: true,
      joinedAt: new Date().toISOString(), termsAcceptedAt: new Date().toISOString(),
    });

    const session = {
      name: adminName.trim(),
      role: "admin",
      gender: genderValue,
      groupSlug: normalizedSlug,
      groupName: groupName.trim(),
      token: `mock-${Date.now()}`,
    };
    lsSet("chilimba:session", session);
    return { ...session, isNew: true };
  }

  return realFetch("/api/groups", { method: "POST", body: JSON.stringify({ groupName, adminName, pin, termsAccepted, gender }) }).then(
    (session) => {
      const { isNew, ...toPersist } = session;
      lsSet("chilimba:session", toPersist);
      return session;
    }
  );
}
