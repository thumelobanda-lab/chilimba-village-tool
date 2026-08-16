/**
 * Admin allowlist — MOCK MODE ONLY.
 *
 * Only names listed here get the "Group Setup" tab when testing locally.
 * This is a developer shortcut, not how admin access actually works: on
 * the real backend, becoming the FIRST admin of a group happens by
 * creating it (see createGroup in lib/api/auth.js). For a group that
 * already exists, any current admin can promote another member from the
 * "Admins" section of Group Setup — no database access needed for that
 * anymore. This allowlist just saves a solo developer from having to
 * create a group and promote themselves every time they want to test the
 * admin-only tabs locally.
 */
export const ADMIN_NAMES = [
  // "Harriet",
  // "Doreen",
];

export function isAdminName(name) {
  if (!name) return false;
  return ADMIN_NAMES.some((a) => a.trim().toLowerCase() === name.trim().toLowerCase());
}
