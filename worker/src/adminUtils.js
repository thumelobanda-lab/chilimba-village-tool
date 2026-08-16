/**
 * Decides whether demoting `targetName` would leave a group with zero
 * admins. Pure — no DB — so the actual safety rule is tested directly
 * (see adminUtils.test.js) rather than only trusted by reading the route.
 *
 * @param {Array<{name: string, role: string}>} members - every member of
 *   the group, as returned by GET /api/admin/members
 * @param {string} targetName - the member being demoted (case-insensitive)
 * @returns {boolean}
 */
export function wouldLeaveZeroAdmins(members, targetName) {
  const target = targetName.trim().toLowerCase();
  const admins = members.filter((m) => m.role === "admin");
  const targetIsAdmin = admins.some((m) => m.name.trim().toLowerCase() === target);
  if (!targetIsAdmin) return false; // demoting a non-admin can't reduce the admin count
  return admins.length <= 1;
}
