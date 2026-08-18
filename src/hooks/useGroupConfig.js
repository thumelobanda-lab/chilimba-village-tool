import { useCallback, useEffect, useState } from "react";
import { getSchedule } from "../lib/api.js";

const EMPTY_CONFIG = {
  groupName: "",
  cycleName: "",
  recipientExempt: true,
  schedule: [],
  funds: [],
  paymentMethods: [],
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

  const reload = useCallback(async () => {
    if (!session) {
      setConfig(EMPTY_CONFIG);
      return;
    }
    const stored = await getSchedule();
    setConfig(stored || EMPTY_CONFIG);
  }, [session]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, setConfig };
}
