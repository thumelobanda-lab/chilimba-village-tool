import React, { useEffect, useState } from "react";
import { getSubscriptionStatus } from "../lib/api.js";

/**
 * The subscription block screen for regular members — deliberately a
 * separate component from Subscription.jsx, which is the admin's full
 * pay/manage screen (price, network, mobile money number, expiry date).
 * A member should never see or reach any of that; all they get here is
 * "not active yet, ask your admin", and they're let through the moment
 * it's activated — same polling Subscription.jsx does for the admin,
 * kept here as its own small check since MOCK_MODE and the real Worker
 * both already centralize the actual status lookup in getSubscriptionStatus.
 */
export default function SubscriptionGate({ onActive }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSubscriptionStatus().then((s) => {
      if (cancelled) return;
      if (s.active) onActive?.();
      else setChecked(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) return <div className="panel">Checking subscription…</div>;

  return (
    <div className="panel">
      <h2 className="panel-title">Waiting on your group's subscription</h2>
      <p className="muted small">
        This group's subscription isn't active yet. Only a group admin can activate it —
        once they do, you'll get access automatically. Nothing for you to do here.
      </p>
    </div>
  );
}
