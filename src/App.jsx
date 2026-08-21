import React, { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import CreateAnotherGroup from "./components/CreateAnotherGroup.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Subscription from "./components/Subscription.jsx";
import SubscriptionGate from "./components/SubscriptionGate.jsx";
import LedgerTable, { money } from "./components/LedgerTable.jsx";
import GroupSetup from "./components/GroupSetup.jsx";
import Reconciliation from "./components/Reconciliation.jsx";
import Reminders from "./components/Reminders.jsx";
import Community from "./components/Community.jsx";
import Profile from "./components/Profile.jsx";
import Loans from "./components/Loans.jsx";
import NavMenu from "./components/NavMenu.jsx";
import Dashboard from "./components/Dashboard.jsx";
import PaymentInfo from "./components/PaymentInfo.jsx";
import NoticeBoard from "./components/NoticeBoard.jsx";
import QuickCalculator from "./components/QuickCalculator.jsx";
import Walkthrough, { hasSeenWalkthrough } from "./components/Walkthrough.jsx";
import { useSession } from "./hooks/useSession.js";
import { useGroupConfig } from "./hooks/useGroupConfig.js";
import { useLedger } from "./hooks/useLedger.js";
import { useOnboarding } from "./hooks/useOnboarding.js";

const TABS = [
  { id: "ledger", label: "My Ledger" },
  { id: "summary", label: "Payment Summary" },
  { id: "reminders", label: "Reminders" },
  { id: "community", label: "Community" },
  { id: "account", label: "My Account" },
  { id: "setup", label: "Group Setup", adminOnly: true },
  { id: "reconciliation", label: "Reconciliation", adminOnly: true },
  { id: "loans", label: "Loans", adminOnly: true },
  { id: "creategroup", label: "Create a New Group", adminOnly: true },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const { session, login, createAdditionalGroup, logout, renameSession, refreshSession } = useSession();
  const { config, setConfig } = useGroupConfig(session);
  const {
    ledger,
    totals,
    isRecipientRow,
    addPayment,
    voidPayment,
    editPayment,
    setDueOverride,
    updatePayout,
    applyFlatRate,
    clearMyData,
  } = useLedger(session, config);
  const onboarding = useOnboarding({ applyFlatRate });

  const [subscribed, setSubscribed] = useState(false);
  const [tab, setTab] = useState("home");
  const [showCalculator, setShowCalculator] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [sessionEndedNotice, setSessionEndedNotice] = useState(false);

  // Auto-opens once per account, the first time the dashboard is actually
  // reached (after login, onboarding, and the subscription gate) —
  // showing it any earlier would explain tabs the person can't see yet.
  // Reopenable any time from "How this app works" in the nav menu, which
  // is why "seen" is tracked separately from whether this effect has fired.
  useEffect(() => {
    if (session && subscribed && !hasSeenWalkthrough(session)) {
      setShowWalkthrough(true);
    }
  }, [session, subscribed]);

  // A separate, generic preview shown before anyone's even signed in —
  // tracked independently (see PRE_LOGIN_SEEN_KEY in Walkthrough.jsx) so
  // seeing this one doesn't skip the personalized, role-aware one above
  // once they actually log in. Runs once on mount, only matters if
  // there's no session yet.
  useEffect(() => {
    if (!session && !hasSeenWalkthrough(null)) {
      setShowWalkthrough(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catches up a stale session (most importantly: role, after being
  // promoted/demoted elsewhere) whenever this tab regains focus — covers
  // the realistic case of "an admin promoted me while I had this tab in
  // the background" without polling constantly. If the session turns
  // out to be invalid outright (expired, account removed), refreshSession
  // already logs out cleanly; this just surfaces why, instead of
  // silently dropping back to the login screen with no explanation.
  useEffect(() => {
    if (!session) return;
    const onFocus = () => {
      if (document.visibilityState !== "hidden") {
        refreshSession().catch(() => setSessionEndedNotice(true));
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const handleLogin = async (groupSlug, name, pin) => {
    const user = await login(groupSlug, name, pin);
    setSessionEndedNotice(false);
    if (user.isNew) onboarding.trigger();
  };

  const handleLogout = () => {
    logout();
    setSubscribed(false);
  };

  const handleFinishOnboarding = (rate) => {
    const nonRecipientIds = config.schedule.filter((r) => !isRecipientRow(r)).map((r) => r.id);
    return onboarding.finish(rate, nonRecipientIds);
  };

  const handleDeleteData = async () => {
    if (!window.confirm("Delete all your saved contributions and subscription data? This can't be undone.")) return;
    await clearMyData();
    setSubscribed(false);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Chilimba Circle</div>
          <div className="muted small">
            {session
              ? config.cycleName
                ? `${session.groupName} · ${config.cycleName}`
                : session.groupName
              : "Sign in to a group"}
          </div>
        </div>
        {session && (
          <div className="header-right">
            <button
              className="btn-ghost calc-icon-btn"
              onClick={() => setShowCalculator(true)}
              aria-label="Open calculator"
              title="Calculator"
            >
              🧮 <span className="calc-icon-label">Calc</span>
            </button>
            <button className="btn-ghost" onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>

      {showCalculator && <QuickCalculator onClose={() => setShowCalculator(false)} />}
      {showWalkthrough && (
        <Walkthrough session={session} onClose={() => setShowWalkthrough(false)} />
      )}

      <main className="app-main">
        {!session ? (
          <Login onLogin={handleLogin} sessionEndedNotice={sessionEndedNotice} />
        ) : onboarding.needsOnboarding ? (
          <Onboarding
            groupName={session.groupName}
            groupDefaultRate={config.schedule.find((r) => !isRecipientRow(r))?.due}
            onComplete={handleFinishOnboarding}
            onSkip={onboarding.skip}
          />
        ) : !subscribed ? (
          session.role === "admin" ? (
            <Subscription onActive={() => setSubscribed(true)} />
          ) : (
            <SubscriptionGate onActive={() => setSubscribed(true)} />
          )
        ) : (
          <>
            <div className="dashboard-greeting">
              <span className="greeting-emoji">👋</span> {greeting()}, <strong>{session.name}</strong>
              {session.role === "admin" && <span className="tag tag-rate" style={{ marginLeft: 8 }}>admin</span>}
            </div>

            <NavMenu
              items={TABS.filter((t) => !t.adminOnly || session.role === "admin")}
              activeId={tab}
              onSelect={setTab}
              onOpenWalkthrough={() => setShowWalkthrough(true)}
            />

            {tab === "home" && (
              <>
                <NoticeBoard isAdmin={session.role === "admin"} />
                <Dashboard session={session} config={config} ledger={ledger} totals={totals} />
              </>
            )}

            {tab !== "home" && (
              <button className="btn-link back-link" onClick={() => setTab("home")}>← Back to Home</button>
            )}

            {tab === "ledger" && (
              <div className="panel" role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger">
                <h2 className="panel-title">My Ledger</h2>
                <PaymentInfo paymentMethods={config.paymentMethods} />

                {config.schedule.length === 0 ? (
                  <p className="muted small" style={{ padding: "20px 0" }}>
                    No payout dates are set up yet. An admin can add them from Group Setup.
                  </p>
                ) : (
                  <>
                    <p className="muted tiny" style={{ marginBottom: 10 }}>
                      Tap "Amount Paid" to log a payment or view its history. Tap "Amount Due" to
                      set your own agreed rate for a date.
                    </p>
                    <LedgerTable
                      rowsComputed={totals.rowsComputed}
                      totals={totals}
                      isRecipientRow={isRecipientRow}
                      onAddPayment={addPayment}
                      onVoidPayment={voidPayment}
                      onEditPayment={editPayment}
                      onSetDueOverride={setDueOverride}
                      memberName={session.name}
                      groupName={config.groupName}
                      cycleName={config.cycleName}
                    />
                  </>
                )}

                <div className="payout-block">
                  <h3 className="panel-subtitle">Payout Received</h3>
                  <div className="field-row">
                    <label className="field">
                      Amount (K)
                      <input
                        type="number"
                        value={ledger.payoutInfo?.amount || 0}
                        onChange={(e) => updatePayout("amount", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Date received
                      <input
                        type="text"
                        placeholder="e.g. 4 Jul 2026"
                        value={ledger.payoutInfo?.date || ""}
                        onChange={(e) => updatePayout("date", e.target.value)}
                      />
                    </label>
                  </div>

                  <table className="summary-table">
                    <tbody>
                      <tr><td>Payout Received</td><td className="ar">{money(ledger.payoutInfo?.amount)}</td></tr>
                      <tr><td>Total Paid to Date</td><td className="ar">{money(totals.paid)}</td></tr>
                      <tr className={totals.net > 0 ? "neg" : "pos"}>
                        <td>Net Position (Payout − Paid)</td><td className="ar">{money(totals.net)}</td>
                      </tr>
                      <tr><td>Remaining Contributions Owed</td><td className="ar">{money(totals.balance)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="privacy-row">
                  <button className="btn-link" onClick={handleDeleteData}>Delete my data</button>
                </div>
              </div>
            )}

            {tab === "summary" && (
              <div className="panel" role="tabpanel" id="panel-summary" aria-labelledby="tab-summary">
                <h2 className="panel-title">Payment Summary</h2>
                <p className="muted tiny" style={{ marginBottom: 14 }}>
                  A read-only summary of your own contribution totals — not the calculator
                  (that's the 🧮 icon in the header).
                </p>
                <div className="calc-grid">
                  <Card label="Required to Date" value={money(totals.due)} />
                  <Card label="Amount You've Put In" value={money(totals.paid)} />
                  <Card label="Outstanding Balance" value={money(totals.balance)} warn={totals.balance > 0} />
                  <Card label="Payout Received" value={money(ledger.payoutInfo?.amount)} highlight />
                  <Card label="Net Position" value={money(totals.net)} warn={totals.net > 0} />
                  <Card
                    label="Suggested Rate / Remaining Date"
                    value={totals.remainingCount > 0 ? money(totals.suggestedRate) : "—"}
                  />
                </div>
              </div>
            )}

            {tab === "setup" && session.role === "admin" && (
              <div role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
                <GroupSetup config={config} onSaved={setConfig} session={session} />
              </div>
            )}

            {tab === "reconciliation" && session.role === "admin" && (
              <div role="tabpanel" id="panel-reconciliation" aria-labelledby="tab-reconciliation">
                <Reconciliation config={config} />
              </div>
            )}

            {tab === "loans" && session.role === "admin" && (
              <div role="tabpanel" id="panel-loans" aria-labelledby="tab-loans"><Loans /></div>
            )}

            {tab === "reminders" && (
              <div role="tabpanel" id="panel-reminders" aria-labelledby="tab-reminders"><Reminders config={config} /></div>
            )}

            {tab === "community" && (
              <div role="tabpanel" id="panel-community" aria-labelledby="tab-community"><Community /></div>
            )}

            {tab === "account" && (
              <div role="tabpanel" id="panel-account" aria-labelledby="tab-account">
                <Profile session={session} onRenamed={renameSession} />
              </div>
            )}

            {tab === "creategroup" && session.role === "admin" && (
              <div role="tabpanel" id="panel-creategroup" aria-labelledby="tab-creategroup">
                <CreateAnotherGroup onCreate={createAdditionalGroup} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Card({ label, value, warn, highlight }) {
  const modifier = warn ? " card-warn" : highlight ? " card-highlight" : "";
  return (
    <div className={"card" + modifier}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}
