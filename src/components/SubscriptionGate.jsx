import React from "react";

/**
 * The member's read-only view of the group's subscription — no pricing,
 * no payment controls, same restriction the admin-only Subscription.jsx
 * always had. No longer a gate (despite the filename, kept to avoid
 * touching every import for a rename): a free-tier group is fully
 * usable, so this is purely informational now, reached from the
 * Subscription nav tab like any other screen rather than blocking
 * everything else until it's active.
 */
export default function SubscriptionGate({ status }) {
  if (!status) return <div className="panel">Checking subscription…</div>;

  if (status.active) {
    return (
      <div className="panel">
        <div className="badge badge-ok">Premium active</div>
        <p className="muted small">
          This group's premium access is valid until {new Date(status.expiresAt).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Free Plan</h2>
      <p className="muted small">
        This group is on the free plan — up to {status.freeTierMaxMembers} members and every
        core ledger feature. Receipts, automated reminders, and community fund splitting
        need premium, which only a group admin can activate.
      </p>
      {status.pending && (
        <p className="muted small">
          A payment claim was already submitted and is awaiting confirmation.
        </p>
      )}
    </div>
  );
}
