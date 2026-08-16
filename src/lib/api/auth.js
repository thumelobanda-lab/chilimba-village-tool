import { randomSalt, hashPin, verifyPin } from "../crypto.js";
import { isAdminName } from "../adminConfig.js";
import { MOCK_MODE, lsGet, lsSet, realFetch } from "./core.js";

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

// First login for a name (within a group) sets the PIN (salted + hashed,
// never stored or sent in plain text). Later logins verify against it.
export async function login(groupSlug, name, pin) {
  if (MOCK_MODE) {
    if (!pin || pin.length < 4) throw new Error("Choose a PIN of at least 4 digits.");
    const slug = normalizeSlug(groupSlug);
    if (!slug) throw new Error("Group code is required.");
    const group = lsGet(groupKey(slug), null);
    if (!group) throw new Error("Unknown group code.");

    const key = accountKey(slug, name);
    const existing = lsGet(key, null);
    let role = "member";

    if (!existing) {
      const salt = randomSalt();
      const hash = await hashPin(pin, salt);
      // adminConfig.js is a mock-only developer shortcut for quick local
      // testing — the real backend has no equivalent; there, the only way
      // to become an admin is creating the group (see createGroup below)
      // or a direct database write. Kept here so a solo dev testing
      // locally doesn't have to reproduce the create-group flow just to
      // reach the admin-only tabs.
      role = isAdminName(name) ? "admin" : "member";
      lsSet(key, { salt, hash, role });
    } else {
      const ok = await verifyPin(pin, existing.salt, existing.hash);
      if (!ok) throw new Error("Incorrect PIN for this name.");
      role = existing.role;
    }

    const session = {
      name: name.trim(),
      role,
      groupSlug: slug,
      groupName: group.groupName,
      token: `mock-${Date.now()}`,
    };
    lsSet("chilimba:session", session); // isNew is not persisted — it should only affect this one login
    return { ...session, isNew: !existing };
  }

  return realFetch("/api/login", { method: "POST", body: JSON.stringify({ groupSlug, name, pin }) }).then(
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

// Creates a brand-new group AND its first admin account in one step —
// there's no platform superadmin to bootstrap an otherwise-empty group,
// so whoever creates it becomes its admin automatically. This is the
// ONLY self-service way to become an admin; every other promotion still
// requires a direct database write (see schema.sql), which stays true
// for groups that already exist.
export async function createGroup({ slug, groupName, adminName, pin }) {
  if (!slug || !slug.trim()) throw new Error("Group code is required.");
  if (!groupName || !groupName.trim()) throw new Error("Group name is required.");
  if (!adminName || !adminName.trim()) throw new Error("Your name is required.");
  if (!pin || pin.length < 4) throw new Error("Choose a PIN of at least 4 digits.");

  if (MOCK_MODE) {
    const normalizedSlug = normalizeSlug(slug);
    if (lsGet(groupKey(normalizedSlug), null)) throw new Error("That group code is already taken.");

    lsSet(groupKey(normalizedSlug), {
      groupName: groupName.trim(),
      cycleName: "Cycle 1",
      recipientExempt: true,
      schedule: [],
      funds: [],
    });

    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    lsSet(accountKey(normalizedSlug, adminName), { salt, hash, role: "admin" });

    const session = {
      name: adminName.trim(),
      role: "admin",
      groupSlug: normalizedSlug,
      groupName: groupName.trim(),
      token: `mock-${Date.now()}`,
    };
    lsSet("chilimba:session", session);
    return { ...session, isNew: true };
  }

  return realFetch("/api/groups", { method: "POST", body: JSON.stringify({ slug, groupName, adminName, pin }) }).then(
    (session) => {
      const { isNew, ...toPersist } = session;
      lsSet("chilimba:session", toPersist);
      return session;
    }
  );
}
