import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";
import { wouldLeaveZeroAdmins } from "../adminUtils.js";
import { findNextDue } from "../scheduleUtils.js";
import { effectiveContribution } from "../ledgerMath.js";

// Every ACTIVE member of the signed-in admin's OWN group, with role,
// when they joined, and the next date they still owe something on —
// powers the roster in Group Setup → Admins. Admin-only, and — same as
// reconciliation — only shows real cross-member data once MOCK_MODE =
// false; in mock mode it can only see accounts created in this browser.
export async function getGroupMembers() {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const config = lsGet(groupScopedKey(session, "group"), null);
    const schedule = config?.schedule || [];
    const recipientExempt = !!config?.recipientExempt;

    const accountPrefix = `chilimba:account:${session.groupSlug}:`;
    const members = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(accountPrefix)) continue;
      const name = key.slice(accountPrefix.length);
      const account = lsGet(key, {});
      if (account.active === false) continue; // removed — drop off the active roster

      const ledger = lsGet(groupScopedKey(session, "ledger", name), { payments: [], dueOverrides: {} });
      const paidByRowId = {};
      (ledger.payments || []).filter((p) => !p.voidedAt).forEach((p) => {
        paidByRowId[p.scheduleRowId] = (paidByRowId[p.scheduleRowId] || 0) + effectiveContribution(p);
      });
      const next = findNextDue(schedule, name, recipientExempt, ledger.dueOverrides || {}, paidByRowId);

      members.push({
        name,
        role: account.role || "member",
        joinedAt: account.joinedAt || null,
        nextDueDate: next?.row.date || null,
        nextDueAmount: next?.balance || 0,
      });
    }
    // Newest-joined first, matching the real backend (see admin.js's
    // ORDER BY created_at DESC) — a member missing joinedAt (shouldn't
    // happen, but defensively) sorts last rather than crashing the compare.
    members.sort((a, b) => new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0));
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

// Removes a member — soft delete, same as the real backend: their
// payment history stays intact, they simply can no longer log in and
// drop off the roster. Restricted to non-admins, matching the server's
// rule — demote an admin first, then remove them.
export async function removeMember(name) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  if (!name || !name.trim()) throw new Error("A name is required.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", name.trim().toLowerCase());
    const account = lsGet(key, null);
    if (!account) throw new Error("No member with that name in your group.");
    if (account.role === "admin") {
      throw new Error("This member is an admin — demote them first, then remove.");
    }
    lsSet(key, { ...account, active: false, removedAt: new Date().toISOString() });
    return { ok: true };
  }

  return realFetch("/api/admin/remove", { method: "POST", body: JSON.stringify({ name }) });
}

// PINs are one-way hashed — there is no way to recover a forgotten one,
// only reset it. Clears the stored hash/salt rather than touching the
// account otherwise (role, join date, payment history all survive) —
// login() above treats an account with no hash/salt the same as a
// brand-new signup for PIN purposes, so whatever the member types on
// their next login simply becomes their new PIN.
export async function resetMemberPin(name) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  if (!name || !name.trim()) throw new Error("A name is required.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "account", name.trim().toLowerCase());
    const account = lsGet(key, null);
    if (!account) throw new Error("No member with that name in your group.");
    if (account.active === false) throw new Error("This member has been removed — nothing to reset.");
    lsSet(key, { ...account, hash: "", salt: "" });
    return { ok: true };
  }

  return realFetch("/api/admin/reset-pin", { method: "POST", body: JSON.stringify({ name }) });
}
