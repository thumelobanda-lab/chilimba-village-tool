import { getGroupMembers } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

/**
 * Every active member's name, for admin forms that would otherwise
 * accept a free-typed name (loan borrower, payout recipients) — the
 * same roster AdminManagement.jsx's "Promote a member" select already
 * draws from. Selecting from (or autocompleting against) the real
 * roster rules out typos rather than just reducing the risk of one.
 * Admin-only, same as getGroupMembers itself.
 */
export function useMemberRoster() {
  const { data, loading, error } = useApiData(getGroupMembers, []);
  return { members: data?.members || [], loading, error };
}
