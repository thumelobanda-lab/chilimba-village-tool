import React, { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import CreateGroup from "./components/CreateGroup.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Subscription from "./components/Subscription.jsx";
import LedgerTable, { money } from "./components/LedgerTable.jsx";
import GroupSetup from "./components/GroupSetup.jsx";
import Reconciliation from "./components/Reconciliation.jsx";
import Reminders from "./components/Reminders.jsx";
import Community from "./components/Community.jsx";
import Profile from "./components/Profile.jsx";
import Loans from "./components/Loans.jsx";
import ScrollableTabs from "./components/ScrollableTabs.jsx";
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
  { id: "calc", label: "Calculator" },
  { id: "reminders", label: "Reminders" },
  { id: "community", label: "Community" },
  { id: "account", label: "My Account" },
  { id: "setup", label: "Group Setup", adminOnly: true },
  { id: "reconciliation", label: "Reconciliation", adminOnly: true },
  { id: "loans", label: "Loans", adminOnly: true },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function App() {
  const { session, login, createGroup, logout, renameSession } = useSession();
  const { config, setConfig } = useGroupConfig(session);
  const {
    ledger,
    totals,
    isRecipientRow,
    addPayment,
    voidPayment,
    setDueOverride,
    updatePayout,
    applyFlatRate,
    clearMyData,
  } = useLedger(session, config);
  const onboarding = useOnboarding({ applyFlatRate });

  const [subscribed, setSubscribed] = useState(false);
  const [tab, setTab] = useState("ledger");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Auto-opens once per account, the first time the dashboard is actually
  // reached (after login, onboarding, and the subscription gate) —
  // showing it any earlier would explain tabs the person can't see yet.
  // Reopenable any time from the ? icon in the header, which is why
  // "seen" is tracked separately from whether this effect has fired.
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

  const handleLogin = async (groupSlug, name, pin) => {
    const user = await login(groupSlug, name, pin);
    if (user.isNew) onboarding.trigger();
  };

  const handleCreateGroup = async (fields) => {
    const user = await createGroup(fields);
    setShowCreateGroup(false);
    if (user.isNew) onboarding.trigger();
  };

  const handleLogout = () => {
    logout();
    setSubscribed(false);
    setShowCreateGroup(false);
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
          <div className="brand">Chilimba Village Tool</div>
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
              onClick={() => setShowWalkthrough(true)}
              aria-label="Open walkthrough"
              title="How this app works"
            >
              ?
            </button>
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
          showCreateGroup ? (
            <CreateGroup onCreate={handleCreateGroup} onBackToLogin={() => setShowCreateGroup(false)} />
          ) : (
            <Login onLogin={handleLogin} onShowCreateGroup={() => setShowCreateGroup(true)} />
          )
        ) : onboarding.needsOnboarding ? (
          <Onboarding
            groupDefaultRate={config.schedule.find((r) => !isRecipientRow(r))?.due}
            onComplete={handleFinishOnboarding}
            onSkip={onboarding.skip}
          />
        ) : !subscribed ? (
          <Subscription session={session} onActive={() => setSubscribed(true)} />
        ) : (
          <>
            <div className="dashboard-greeting">
              <span className="greeting-emoji">👋</span> {greeting()}, <strong>{session.name}</strong>
              {session.role === "admin" && <span className="tag tag-rate" style={{ marginLeft: 8 }}>admin</span>}
            </div>

            <NoticeBoard isAdmin={session.role === "admin"} />

            <ScrollableTabs>
              {TABS.filter((t) => !t.adminOnly || session.role === "admin").map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  id={`tab-${t.id}`}
                  aria-controls={`panel-${t.id}`}
                  className={tab === t.id ? "tab active" : "tab"}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </ScrollableTabs>

            {tab === "ledger" && (
              <div className="panel" role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger">
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
                      onSetDueOverride={setDueOverride}
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

            {tab === "calc" && (
              <div className="panel calc-grid" role="tabpanel" id="panel-calc" aria-labelledby="tab-calc">
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
