import React from "react";

/**
 * A small, non-blocking dashboard banner for a free-tier group — the
 * previous design blocked the ENTIRE app until a subscription (fake or
 * real) was active; this replaces that with something that just states
 * the limits plainly and points an admin at how to lift them, while
 * every core feature keeps working underneath it. Rendered only when
 * status is loaded and not active (see App.jsx) — never shown at all
 * once premium.
 */
export default function FreeTierBanner({ status, isAdmin, onUpgrade }) {
  if (!status || status.active) return null;

  return (
    <div className="panel free-tier-banner">
      <div className="free-tier-banner-row">
        <div>
          <strong>Free plan</strong>
          <span className="muted small" style={{ marginLeft: 8 }}>
            core payment-tracking features, {status.memberCount}/{status.freeTierMaxMembers} members — no
            receipts, automated reminders, or community fund splitting
          </span>
        </div>
        {isAdmin && (
          <button className="btn-ghost-dark" onClick={onUpgrade}>
            {status.pending ? "Payment pending review" : "Upgrade"}
          </button>
        )}
      </div>
    </div>
  );
}
