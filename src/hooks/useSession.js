import { useState } from "react";
import {
  currentSession,
  login as apiLogin,
  join as apiJoin,
  createGroup as apiCreateGroup,
  logout as apiLogout,
  getMe as apiGetMe,
} from "../lib/api.js";
import { lsSet } from "../lib/api/core.js";
import { getMyGroups, rememberGroup, forgetGroup, forgetAllGroups } from "../lib/myGroups.js";

/**
 * Owns just the session lifecycle. Doesn't know about the ledger or
 * onboarding — App.jsx wires those together using the `isNew` flag
 * login()/createGroup() return. A group is identified by its slug,
 * entered alongside name + PIN — one Worker + one database can host many
 * independent groups this way, without per-group subdomains or routing.
 *
 * Each group membership is still a fully separate account (see
 * worker/schema/schema.sql — that's intentional, not a gap). What this
 * hook adds on top is device-local: `myGroups` remembers every one of
 * those separate sessions this browser has successfully signed into
 * (see lib/myGroups.js), so `switchGroup` can hop between them without a
 * full logout/login round trip. It's the same underlying multi-account
 * model as always, just with the browser doing the remembering instead
 * of the member re-typing a PIN every time.
 */
export function useSession() {
  const [session, setSession] = useState(currentSession());
  // Backfills an existing signed-in session into myGroups the first time
  // this loads after the feature ships — before this, myGroups simply
  // didn't exist, so a member who was already signed in shouldn't lose
  // their current group from the switcher just because they update mid-
  // session.
  const [myGroups, setMyGroups] = useState(() => {
    const stored = getMyGroups();
    const active = currentSession();
    if (active && !stored.some((g) => g.groupSlug === active.groupSlug)) {
      return rememberGroup(active);
    }
    return stored;
  });

  const login = async (groupSlug, identifier, pin) => {
    const user = await apiLogin(groupSlug, identifier, pin);
    setMyGroups(rememberGroup(user));
    setSession(user);
    return user;
  };

  // Sign-up — creates a brand-new member account (name + phone + PIN).
  // Deliberately a separate call from login() above, not a fallback it
  // reaches for on a not-found identifier: see auth.js for why the split
  // matters (phone collection has to be unskippable).
  const join = async (groupSlug, name, phone, pin, termsAccepted) => {
    const user = await apiJoin(groupSlug, name, phone, pin, termsAccepted);
    setMyGroups(rememberGroup(user));
    setSession(user);
    return user;
  };

  const createGroup = async (fields) => {
    const user = await apiCreateGroup(fields);
    setMyGroups(rememberGroup(user));
    setSession(user);
    return user;
  };

  // Lets an already-signed-in admin spin up a brand-new, unrelated group
  // (see NavMenu's admin-only "Create a New Group") without losing their
  // current session — unlike createGroup() above, used pre-login where
  // there's no session yet to preserve, this deliberately does NOT call
  // setSession or remember the new group. The admin isn't actually a
  // member of that new group (it gets its own separate admin account —
  // see CreateAnotherGroup.jsx), so it has no business in this device's
  // "my groups" list; the new group's details are returned so the caller
  // can show them (its code, to hand to whoever will actually run it).
  const createAdditionalGroup = async (fields) => {
    return apiCreateGroup(fields);
  };

  // Hops to a group already remembered on this device (see
  // GroupSwitcher.jsx) without a full logout/login. Validates the stored
  // token is still good via getMe() before committing to it — one could
  // have expired (session TTL) or been revoked (the member was removed)
  // since it was last used, and this should degrade the same way any
  // other stale session does: drop it and say so, not silently switch
  // into a broken state.
  const switchGroup = async (groupSlug) => {
    const target = myGroups.find((g) => g.groupSlug === groupSlug);
    if (!target) throw new Error("That group isn't in your list anymore — sign in again to add it.");
    lsSet("chilimba:session", target);
    try {
      const fresh = await apiGetMe();
      const merged = { ...target, ...fresh };
      lsSet("chilimba:session", merged);
      setMyGroups(rememberGroup(merged));
      setSession(merged);
      return merged;
    } catch (e) {
      setMyGroups(forgetGroup(groupSlug));
      apiLogout();
      setSession(null);
      throw e;
    }
  };

  // Drops one group from this device's remembered list — e.g. "remove"
  // in the switcher for a group you no longer want offered. Removing the
  // one you're currently signed into also signs you out of it (there's
  // no sense staying "in" a group that's no longer in the list); removing
  // any other one just forgets it, leaving your active session untouched.
  const removeGroup = (groupSlug) => {
    setMyGroups(forgetGroup(groupSlug));
    if (session?.groupSlug === groupSlug) {
      apiLogout();
      setSession(null);
    }
  };

  // A full sign-out — every remembered group on this device, not just
  // the active one, matching what "Log out" has always meant here.
  // Switching away from just one group without losing the others is
  // removeGroup()'s job, not this one's.
  const logout = () => {
    apiLogout();
    forgetAllGroups();
    setMyGroups([]);
    setSession(null);
  };

  // Catches up a stale session — most notably role, after being
  // promoted/demoted by another admin in a different tab/session — by
  // re-reading it from the backend (getMe(), which requireSession()
  // already checks fresh on every request server-side; this just syncs
  // the frontend's cached copy). App.jsx calls this on window
  // focus/visibility. If the session is no longer valid at all (token
  // expired, account removed) rather than merely changed, this logs out
  // of just this one group (see switchGroup's catch above for the same
  // reasoning) and rethrows so the caller can show a "sign in again"
  // message — never leaves a half-stale session sitting around.
  const refreshSession = async () => {
    if (!session) return;
    try {
      const fresh = await apiGetMe();
      setSession((prev) => (prev ? { ...prev, ...fresh } : prev));
      setMyGroups((prev) => (session ? rememberGroup({ ...session, ...fresh }) : prev));
    } catch (e) {
      setMyGroups(forgetGroup(session.groupSlug));
      apiLogout();
      setSession(null);
      throw e;
    }
  };

  // updateProfile() (lib/api/profile.js) already persists the new display
  // name to the stored session in localStorage — this just mirrors that
  // into the in-memory session so the header greeting and every other
  // component reading `session.name` update immediately, without needing
  // a full page reload to pick the change back up.
  const renameSession = (name) => {
    setSession((prev) => (prev ? { ...prev, name } : prev));
  };

  return {
    session,
    myGroups,
    login,
    join,
    createGroup,
    createAdditionalGroup,
    switchGroup,
    removeGroup,
    logout,
    renameSession,
    refreshSession,
  };
}
