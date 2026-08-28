import { useCallback, useEffect, useRef, useState } from "react";
import { getSchedule } from "../lib/api.js";

const EMPTY_CONFIG = {
  groupName: "",
  cycleName: "",
  recipientExempt: true,
  schedule: [],
  funds: [],
  paymentMethods: [],
  paymentInterval: "biweekly",
};

/**
 * Loads the signed-in member's group config (schedule + funds). Depends
 * on `session` — with multiple groups, there's no config to fetch before
 * knowing who's asking, and switching accounts (a different group) needs
 * a refetch, not the previous group's data lingering in state.
 *
 * Deliberately does NOT auto-seed a default schedule into an empty
 * config: every group is created with an empty schedule (see
 * createGroup in lib/api/auth.js) and is expected to be filled in from
 * Group Setup — auto-seeding one real group's actual payout schedule
 * into every new group would be wrong, not a convenience.
 */
export function useGroupConfig(session) {
  const [config, setConfig] = useState(EMPTY_CONFIG);
  // Tracks whose config is currently in state, so a failed reload can
  // tell "this is a retry for the group already showing" (safe to leave
  // state alone) apart from "this is a brand new session and we've never
  // loaded anything for it" (must not leak the previous group's data).
  const loadedFor = useRef(null);

  const reload = useCallback(async () => {
    if (!session) {
      loadedFor.current = null;
      setConfig(EMPTY_CONFIG);
      return;
    }
    const key = `${session.groupSlug}:${session.name}`;
    if (loadedFor.current !== key) {
      loadedFor.current = key;
      setConfig(EMPTY_CONFIG);
    }
    try {
      const stored = await getSchedule();
      setConfig(stored || EMPTY_CONFIG);
    } catch {
      // Offline with nothing cached (core.js's realFetch already falls
      // back to a cached copy whenever one exists for this session) —
      // if this is a same-session retry, config correctly stays whatever
      // was last successfully loaded rather than reverting to
      // EMPTY_CONFIG (which would misleadingly look like "this group has
      // no schedule" instead of "couldn't load right now"). If it was a
      // brand new session, the reset above already happened, so this
      // never shows a previous group's data.
    }
  }, [session]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, setConfig, reload };
}
