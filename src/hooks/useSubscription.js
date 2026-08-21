import { useEffect, useState, useCallback } from "react";
import { getSubscriptionStatus } from "../lib/api.js";

/**
 * The signed-in member's group subscription status — fetched once a
 * session exists, refreshable on demand (Subscription.jsx calls
 * refresh() right after submitting a payment claim). `active` is the one
 * field that matters almost everywhere: every group without it is free
 * tier — still usable, just capped and missing premium features (see
 * FreeTierBanner.jsx) — never a block screen anymore.
 */
export function useSubscription(session) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setStatus(null);
      setLoading(false);
      return;
    }
    try {
      const s = await getSubscriptionStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return { status, loading, refresh };
}
