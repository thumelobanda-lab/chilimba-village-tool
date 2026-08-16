// See worker/src/adminUtils.js for the full explanation and the tests —
// duplicated here (not imported across directories) so the Worker stays
// deployable on its own, same pattern as scheduleUtils.js and fundUtils.js.
export function wouldLeaveZeroAdmins(members, targetName) {
  const target = targetName.trim().toLowerCase();
  const admins = members.filter((m) => m.role === "admin");
  const targetIsAdmin = admins.some((m) => m.name.trim().toLowerCase() === target);
  if (!targetIsAdmin) return false;
  return admins.length <= 1;
}
