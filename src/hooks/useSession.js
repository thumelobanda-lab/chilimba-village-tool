import { useState } from "react";
import { currentSession, login as apiLogin, createGroup as apiCreateGroup, logout as apiLogout } from "../lib/api.js";

/**
 * Owns just the session lifecycle. Doesn't know about the ledger or
 * onboarding — App.jsx wires those together using the `isNew` flag
 * login()/createGroup() return. A group is identified by its slug,
 * entered alongside name + PIN — one Worker + one database can host many
 * independent groups this way, without per-group subdomains or routing.
 */
export function useSession() {
  const [session, setSession] = useState(currentSession());

  const login = async (groupSlug, name, pin) => {
    const user = await apiLogin(groupSlug, name, pin);
    setSession(user);
    return user;
  };

  const createGroup = async (fields) => {
    const user = await apiCreateGroup(fields);
    setSession(user);
    return user;
  };

  // Lets an already-signed-in admin spin up a brand-new, unrelated group
  // (see NavMenu's admin-only "Create a New Group") without losing their
  // current session — unlike createGroup() above, used pre-login where
  // there's no session yet to preserve, this deliberately does NOT call
  // setSession. The admin stays in their current group; the new group's
  // details are returned so the caller can show them (its code, to hand
  // to that group's own members), not silently switch context into it.
  const createAdditionalGroup = async (fields) => {
    return apiCreateGroup(fields);
  };

  const logout = () => {
    apiLogout();
    setSession(null);
  };

  // updateProfile() (lib/api/profile.js) already persists the new display
  // name to the stored session in localStorage — this just mirrors that
  // into the in-memory session so the header greeting and every other
  // component reading `session.name` update immediately, without needing
  // a full page reload to pick the change back up.
  const renameSession = (name) => {
    setSession((prev) => (prev ? { ...prev, name } : prev));
  };

  return { session, login, createGroup, createAdditionalGroup, logout, renameSession };
}
