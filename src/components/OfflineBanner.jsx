import React from "react";

/**
 * The one honest status line for offline/sync state — see
 * useOfflineSync.js. Renders nothing once there's genuinely nothing to
 * report (online, nothing queued), rather than a banner that's always
 * present and just changes color.
 */
export default function OfflineBanner({ online, pending, syncing }) {
  if (online && pending === 0) return null;

  // "item(s)" rather than "payment(s)" — the outbox also holds an
  // admin's confirm/reject actions (see reconciliation.js), not just a
  // member's own logged payments, and this banner is shown app-wide.
  let text;
  if (!online && pending > 0) {
    text = `You're offline — ${pending} ${pending === 1 ? "change" : "changes"} saved on this device, will sync once you're back online.`;
  } else if (!online) {
    text = "You're offline — showing what was last saved on this device.";
  } else if (syncing) {
    text = `Syncing ${pending} saved ${pending === 1 ? "change" : "changes"}…`;
  } else {
    text = `${pending} ${pending === 1 ? "change" : "changes"} waiting to sync.`;
  }

  return (
    <div className={"offline-banner" + (online ? " offline-banner-syncing" : "")} role="status">
      {text}
    </div>
  );
}
