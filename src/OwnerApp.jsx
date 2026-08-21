import React, { useState } from "react";
import OwnerLogin from "./components/owner/OwnerLogin.jsx";
import OwnerDashboard from "./components/owner/OwnerDashboard.jsx";
import { currentOwnerSession } from "./lib/api/owner.js";

/**
 * A completely separate component tree from App.jsx (see main.jsx for
 * where the split happens) — the platform-owner surface never renders
 * alongside, inside, or as a sibling of the group-member app, and reads
 * its session from a different localStorage key entirely
 * (currentOwnerSession, not the group session's currentSession). There
 * is no shared state, shared component, or shared code path between
 * "signed in as a group admin" and "signed in as the platform owner" —
 * the isolation asked for is structural, not a role check layered on
 * top of one login system.
 */
export default function OwnerApp() {
  const [session, setSession] = useState(currentOwnerSession());

  if (!session) {
    return <OwnerLogin onSignedIn={setSession} />;
  }
  return <OwnerDashboard session={session} onSignedOut={() => setSession(null)} />;
}
