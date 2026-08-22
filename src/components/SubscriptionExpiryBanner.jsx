import React, { useEffect, useState } from "react";
import { isExpiringSoon, daysUntilExpiry } from "../lib/subscriptionUtils.js";

function dismissKey(groupSlug, expiresAt) {
  return `chilimba:dismissed-subscription-expiry:${groupSlug}:${expiresAt}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * A dismissible heads-up once an already-active subscription is close to
 * running out — distinct from FreeTierBanner, which only shows once a
 * group has ALREADY dropped to free tier. The two are mutually exclusive
 * (this checks status.active, FreeTierBanner checks !status.active), so
 * there's no risk of both showing at once for the same group.
 *
 * Dismissal is keyed to the specific expiresAt value, not just the group
 * — so renewing (which sets a new expiresAt) naturally un-dismisses the
 * warning for the next cycle, rather than silencing it forever the first
 * time an admin closes it.
 */
export default function SubscriptionExpiryBanner({ status, isAdmin, groupSlug, onUpgrade }) {
  const expiresAt = status?.expiresAt;
  const [dismissed, setDismissed] = useState(false);

  // status loads asynchronously — if this component mounted before it
  // arrived, the useState initializer would have locked onto expiresAt
  // being undefined and "dismissed" would incorrectly stay false forever,
  // even once the real expiresAt (and its matching localStorage entry)
  // showed up. Re-check once expiresAt is actually known, same fix as
  // Reconciliation.jsx's rowId.
  useEffect(() => {
    if (!expiresAt) return;
    setDismissed(localStorage.getItem(dismissKey(groupSlug, expiresAt)) === "1");
  }, [groupSlug, expiresAt]);

  if (!isAdmin || !status?.active || !expiresAt) return null;
  if (!isExpiringSoon(expiresAt)) return null;
  if (dismissed) return null;

  const days = daysUntilExpiry(expiresAt);

  const handleDismiss = () => {
    localStorage.setItem(dismissKey(groupSlug, expiresAt), "1");
    setDismissed(true);
  };

  return (
    <div className="payout-ack" role="status">
      <span>
        ⏳ Your group's premium access {days <= 1 ? "expires today" : `expires in ${days} days`} —{" "}
        {formatDate(expiresAt)}. Renew to keep receipts, reminders, and fund splitting.{" "}
        <button className="btn-link" onClick={onUpgrade}>Renew now</button>
      </span>
      <button className="payout-ack-dismiss" onClick={handleDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
