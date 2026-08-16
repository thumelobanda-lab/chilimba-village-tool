import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";
import { wouldLeaveZeroAdmins } from "../adminUtils.js";

// Every member of the signed-in admin's OWN group, with their current
// role. Admin-only, and — same as reconciliation — only shows real
// cross-member data once MOCK_MODE = false; in mock mode it can only see
// accounts created in this browser.
export async function getGroupMembers() {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const prefix = `chilimba:account:${session.groupSlug}:`;
    const members = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length);
      const account = lsGet(key, {});
      members.push({ name, role: account.role || "member" });
    }
    members.sort((a, b) => a.name.localeCompare(b.name));
    return { members };
  }

  return realFetch("/api/admin/members");
}

// Promotes another member of the admin's own group. The only self-service
// way to gain admin rights for a group that already exists — becoming
// the first admin of a brand-new group happens through createGroup()
// instead (see lib/api/auth.js).
export async function promoteMember(name) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  if (!name || !name.trim()) throw new Error("A name is required.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", name.trim().toLowerCase());
    const account = lsGet(key, null);
    if (!account) throw new Error("No member with that name in your group.");
    lsSet(key, { ...account, role: "admin" });
    return { ok: true };
  }

  return realFetch("/api/admin/promote", { method: "POST", body: JSON.stringify({ name }) });
}

// Demotes an admin back to member — blocked locally (and re-checked
// server-side) if it would leave the group with zero admins.
export async function demoteMember(name) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  if (!name || !name.trim()) throw new Error("A name is required.");

  if (MOCK_MODE) {
    const { members } = await getGroupMembers();
    if (wouldLeaveZeroAdmins(members, name)) {
      throw new Error("This is the only admin left — promote someone else first.");
    }
    const key = groupScopedKey(session, "account", name.trim().toLowerCase());
    const account = lsGet(key, null);
    if (!account) throw new Error("No member with that name in your group.");
    lsSet(key, { ...account, role: "member" });
    return { ok: true };
  }

  return realFetch("/api/admin/demote", { method: "POST", body: JSON.stringify({ name }) });
}
