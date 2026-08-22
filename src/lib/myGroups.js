/**
 * The device-local registry of every group this browser has signed into
 * — what powers the group switcher (GroupSwitcher.jsx). Deliberately NOT
 * a server-side concept: each group membership is still a fully separate
 * account (its own PIN, its own row — see worker/schema/schema.sql's
 * comment on why that's intentional), so there is no single "account" on
 * the backend to list groups for. This just remembers, per device, which
 * of those separate sessions you've already proven you can sign into,
 * so switching between them doesn't require a full logout/login each
 * time. A new device — or clearing storage — means signing in fresh,
 * same as it always has.
 */

const MY_GROUPS_KEY = "chilimba:my-groups";

/**
 * Adds or updates one group's entry in a list, keyed by groupSlug — pure,
 * so the dedup rule is testable without localStorage. One browser is
 * only ever expected to hold one remembered membership per group at a
 * time; re-joining/re-signing-into a group you're already remembered in
 * just refreshes that entry's token rather than duplicating it.
 *
 * @param {Array<object>} list
 * @param {{groupSlug:string, groupName:string, name:string, role:string, token:string}} entry
 * @returns {Array<object>}
 */
export function upsertGroupList(list, entry) {
  const record = {
    groupSlug: entry.groupSlug,
    groupName: entry.groupName,
    name: entry.name,
    role: entry.role,
    token: entry.token,
  };
  const idx = list.findIndex((g) => g.groupSlug === entry.groupSlug);
  if (idx === -1) return [...list, record];
  const next = list.slice();
  next[idx] = record;
  return next;
}

function readStored() {
  try {
    const raw = localStorage.getItem(MY_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStored(list) {
  localStorage.setItem(MY_GROUPS_KEY, JSON.stringify(list));
}

export function getMyGroups() {
  return readStored();
}

/** Remembers (or refreshes) one group session on this device; returns the updated list. */
export function rememberGroup(session) {
  const next = upsertGroupList(readStored(), session);
  writeStored(next);
  return next;
}

/** Drops one group from this device's remembered list; returns the updated list. */
export function forgetGroup(groupSlug) {
  const next = readStored().filter((g) => g.groupSlug !== groupSlug);
  writeStored(next);
  return next;
}

/** Clears every remembered group on this device (full sign-out). */
export function forgetAllGroups() {
  localStorage.removeItem(MY_GROUPS_KEY);
}
