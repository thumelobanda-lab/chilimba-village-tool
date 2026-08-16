import { useState } from "react";

/**
 * Owns the "does this member need the onboarding rate prompt" flag and
 * its two resolutions (set a rate / skip). Depends on the ledger hook's
 * applyFlatRate rather than reimplementing it — onboarding is just one
 * particular way of calling it.
 */
export function useOnboarding({ applyFlatRate }) {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const trigger = () => setNeedsOnboarding(true);

  const finish = async (rate, nonRecipientRowIds) => {
    await applyFlatRate(nonRecipientRowIds, rate);
    setNeedsOnboarding(false);
  };

  const skip = () => setNeedsOnboarding(false);

  return { needsOnboarding, trigger, finish, skip };
}
