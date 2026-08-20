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

  return { session, login, createGroup, logout, renameSession };
}
