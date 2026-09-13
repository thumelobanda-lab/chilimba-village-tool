import React, { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import CreateAnotherGroup from "./components/CreateAnotherGroup.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Subscription from "./components/Subscription.jsx";
import SubscriptionGate from "./components/SubscriptionGate.jsx";
import SubscriptionExpiryBanner from "./components/SubscriptionExpiryBanner.jsx";
import LedgerTable, { money } from "./components/LedgerTable.jsx";
import GroupSetup from "./components/GroupSetup.jsx";
import Reconciliation from "./components/Reconciliation.jsx";
import Reminders from "./components/Reminders.jsx";
import Community from "./components/Community.jsx";
import Profile from "./components/Profile.jsx";
import ToolsPanel from "./components/ToolsPanel.jsx";
import Loans from "./components/Loans.jsx";
import NavMenu from "./components/NavMenu.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import DesktopTabBar from "./components/DesktopTabBar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import PaymentInfo from "./components/PaymentInfo.jsx";
import PlatformMessageBanner from "./components/PlatformMessageBanner.jsx";
import Toast from "./components/Toast.jsx";
import PaymentOptions from "./components/PaymentOptions.jsx";
import QuickCalculator from "./components/QuickCalculator.jsx";
import Walkthrough, { hasSeenWalkthrough } from "./components/Walkthrough.jsx";
import GroupSwitcher from "./components/GroupSwitcher.jsx";
import AddGroupModal from "./components/AddGroupModal.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import MyReceipts from "./components/MyReceipts.jsx";
import OwnerDashboard from "./components/owner/OwnerDashboard.jsx";
import ProfilePreview from "./components/ProfilePreview.jsx";
import Icon from "./components/Icon.jsx";
import { currentOwnerSession, ownerLogin } from "./lib/api/owner.js";
import { getProfilePhotoUrl } from "./lib/api.js";
import { useSession } from "./hooks/useSession.js";
import { useGroupConfig } from "./hooks/useGroupConfig.js";
import { useLedger } from "./hooks/useLedger.js";
import { useOnboarding } from "./hooks/useOnboarding.js";
import { useSubscription } from "./hooks/useSubscription.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useOfflineSync } from "./hooks/useOfflineSync.js";
import { useReceipts } from "./hooks/useReceipts.js";
import { useTheme } from "./hooks/useTheme.js";
import { useApiData } from "./lib/useApiData.js";
import { greeting, genderedAddress } from "./lib/dashboardMath.js";
import { findNextDue } from "./lib/scheduleUtils.js";
import { getPendingPayments } from "./lib/api.js";

const TABS = [
  { id: "ledger", label: "My Payment History" },
  { id: "receipts", label: "My Receipts" },
  { id: "payment-options", label: "Payment Options" },
  { id: "summary", label: "Payment Summary" },
  { id: "reminders", label: "Reminders" },
  { id: "community", label: "Community" },
  { id: "subscription", label: "Group Membership Plan" },
  { id: "account", label: "My Account" },
  { id: "tools", label: "Tools" },
  { id: "setup", label: "Group Setup", adminOnly: true },
  { id: "reconciliation", label: "Payment Review", adminOnly: true },
  { id: "loans", label: "Loans", adminOnly: true },
  { id: "creategroup", label: "Create a New Group", adminOnly: true },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  // The platform owner is a structurally separate credential from a
  // group session (see lib/api/owner.js) — its own localStorage key, its
  // own backend auth. Kept as independent state here (rather than folded
  // into useSession's group session) so OwnerDashboard's early return
  // below stays a pure UI branch with no risk of one session type
  // silently overwriting the other.
  const [ownerSession, setOwnerSession] = useState(currentOwnerSession());
  const {
    session,
    myGroups,
    login,
    join,
    createGroup,
    createAdditionalGroup,
    switchGroup,
    removeGroup,
    logout,
    renameSession,
    refreshSession,
  } = useSession();
  const { config, setConfig, reload: reloadConfig } = useGroupConfig(session);
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
    reload: reloadLedger,
  } = useLedger(session, config);
  // Fires once the offline write outbox actually syncs something (see
  // useOfflineSync.js) — re-fetches both from the server so the ledger's
  // pendingSync overlay entries (getMyLedger in contributions.js) get
  // replaced by the real, now-confirmed-delivered rows, and the schedule
  // picks up anything an admin changed while this member was offline.
  const { online, pending: pendingSyncCount, syncing } = useOfflineSync(async () => {
    await Promise.all([reloadLedger(), reloadConfig()]);
  });
  const onboarding = useOnboarding({ applyFlatRate });
  const subscription = useSubscription(session);
  // Cheap and pure — recomputed here (App.jsx) rather than lifted out of
  // Dashboard.jsx's own copy, since the notification bell lives in the
  // global header and needs it on every tab, not just Home.
  const paidByRowId = Object.fromEntries((totals.rowsComputed || []).map((r) => [r.id, r.paid]));
  const nextDue = findNextDue(
    config.schedule,
    session?.name,
    config.recipientExempt,
    ledger.dueOverrides || {},
    paidByRowId
  );
  const notifications = useNotifications(session, ledger.payments, nextDue, subscription.status?.active);
  const receipts = useReceipts(session, totals.rowsComputed);
  // Admin-only pending-confirmation count, needed here (not just inside
  // Dashboard.jsx's own copy) so the header's notification bell can carry
  // the same urgency signal on every tab, not just Home — see
  // NotificationBell.jsx's `urgent` prop.
  const { data: pendingData } = useApiData(
    session?.role === "admin" ? getPendingPayments : () => Promise.resolve(null),
    [session?.role]
  );
  const pendingConfirmCount = pendingData?.pending?.length || 0;

  const [tab, setTab] = useState("home");
  // Shared between the header's hamburger trigger and BottomTabBar's
  // Menu tab (mobile only) — both open/close the exact same NavMenu
  // panel rather than each owning an independent one. See NavMenu.jsx's
  // doc comment for why this moved out of that component.
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [sessionEndedNotice, setSessionEndedNotice] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState("");
  // One fetch for the signed-in member's own photo, same pattern as
  // Profile.jsx's own copy — this is always exactly one member, so
  // there's no "wasted round trip for everyone with no photo" concern
  // the way there would be fetching a whole roster speculatively.
  // Header-only (not shared with Profile.jsx's own fetch): two small
  // independent object-URL lifecycles are simpler and safer than lifting
  // this into shared state that two unrelated components would both need
  // to revoke correctly.
  const [headerPhotoUrl, setHeaderPhotoUrl] = useState(null);
  useEffect(() => {
    if (!session) {
      setHeaderPhotoUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    getProfilePhotoUrl(session.name).then((url) => {
      if (cancelled) return;
      objectUrl = url;
      setHeaderPhotoUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.name, session?.groupSlug]);
  // Set when "Log a Payment" is tapped from the dashboard CTA — tells
  // LedgerTable which row to auto-expand, scroll to, and focus so a
  // member never has to hunt for the right collapsed date entry
  // themselves. Cleared once LedgerTable has consumed it.
  const [focusPaymentRowId, setFocusPaymentRowId] = useState(null);

  // The Amount field commits on every keystroke (see updatePayout in
  // useLedger.js — optimistic, no separate save button), so the toast
  // only fires once the field is left, not per digit typed. The Date
  // field is a native picker whose onChange only fires on a discrete
  // selection, so it can toast immediately.
  const updatePayoutAndConfirm = async (field, value) => {
    await updatePayout(field, value);
    if (field === "date") {
      setPayoutStatus("Saved");
      setTimeout(() => setPayoutStatus(""), 1500);
    }
  };
  const confirmPayoutAmountSaved = () => {
    setPayoutStatus("Saved");
    setTimeout(() => setPayoutStatus(""), 1500);
  };

  // Auto-opens once per account, the first time the dashboard is actually
  // reached (after login and onboarding) — a free-tier group reaches the
  // dashboard immediately now (see FreeTierBanner, rendered from
  // Profile.jsx's "My Account" rather than the dashboard itself), so this
  // no longer waits on subscription status at all. Reopenable any time from
  // "How this app works" in the nav menu, which is why "seen" is tracked
  // separately from whether this effect has fired.
  useEffect(() => {
    if (session && !onboarding.needsOnboarding && !hasSeenWalkthrough(session)) {
      setShowWalkthrough(true);
    }
  }, [session, onboarding.needsOnboarding]);

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

  // Land on the dashboard whenever the active group changes — covers
  // every path that swaps `session` without unmounting App (a brand new
  // signup, joining a group via AddGroupModal's onJoin={join}, switching
  // to an already-remembered group), not just the very first login.
  // Without this, `tab` state just carries over from whatever screen was
  // open on the previous group, which can land on a tab that doesn't
  // even make sense for the new account (e.g. an admin-only tab for a
  // group where this member isn't an admin).
  useEffect(() => {
    if (session) setTab("home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.groupSlug]);

  const handleLogin = async (groupSlug, identifier, pin) => {
    const user = await login(groupSlug, identifier, pin);
    setSessionEndedNotice(false);
    if (user.isNew) onboarding.trigger();
  };

  const handleJoin = async (groupSlug, name, phone, pin, termsAccepted, gender) => {
    const user = await join(groupSlug, name, phone, pin, termsAccepted, gender);
    setSessionEndedNotice(false);
    if (user.isNew) onboarding.trigger();
  };

  // Dev-only: lets Login.jsx's hidden "create a group" shortcut (visible
  // only when import.meta.env.DEV && MOCK_MODE — see Login.jsx) bootstrap
  // a first group without an existing admin session. Production self-serve
  // group creation stays admin-gated (the "creategroup" tab further down,
  // reachable only once already signed in as an admin, via
  // CreateAnotherGroup/createAdditionalGroup) — this is purely a
  // local-testing shortcut for the pre-login chicken-and-egg case: a fresh
  // mock-mode browser has no group to sign into yet.
  const handleDevCreateGroup = async (fields) => {
    const user = await createGroup(fields);
    setSessionEndedNotice(false);
    if (user.isNew) onboarding.trigger();
  };

  const handleLogout = () => {
    logout();
  };

  const handleOwnerLogin = async (email, password) => {
    const owner = await ownerLogin(email, password);
    setOwnerSession(owner);
  };

  const openLedgerToPay = () => {
    if (nextDue) setFocusPaymentRowId(nextDue.row.id);
    setTab("ledger");
  };

  // Receipts are marked seen the moment the member actually opens the
  // list — not on confirmation, so the badge stays lit until they've
  // genuinely looked, same "seen, not dismissed" semantics as everywhere
  // else this app tracks per-member local state.
  useEffect(() => {
    if (tab === "receipts") receipts.markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Tab switches don't reset scroll position on their own — returning to
  // Home after scrolling partway down another tab (e.g. a long Ledger
  // list, right after confirming a payment) otherwise leaves the browser
  // still scrolled down, so Home's top content (admin notices,
  // PayoutAcknowledgment's "you just got paid out" banner, etc.) renders
  // partially above the still-scrolled viewport — looks clipped, though
  // it's really a stale scroll position, not a layout bug. Scoped to
  // "home" only, not every tab, so it doesn't fight Ledger's own
  // scroll-to-the-focused-row behavior (LedgerTable.jsx, driven by
  // focusPaymentRowId below) when landing there instead.
  useEffect(() => {
    if (tab === "home") window.scrollTo(0, 0);
  }, [tab]);

  const handleFinishOnboarding = (rate) => {
    const nonRecipientIds = config.schedule.filter((r) => !isRecipientRow(r)).map((r) => r.id);
    return onboarding.finish(rate, nonRecipientIds);
  };

  const handleDeleteData = async () => {
    if (!window.confirm("Delete all your saved contributions and subscription data? This can't be undone.")) return;
    await clearMyData();
  };

  // Renders standalone, not nested inside this component's own app-shell
  // below — OwnerDashboard already renders its own header/shell (same
  // structural isolation the old separate OwnerApp.jsx tree had), it's
  // just reached from the same login screen and component tree now.
  if (ownerSession) {
    return <OwnerDashboard session={ownerSession} onSignedOut={() => setOwnerSession(null)} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-row">
            {session && (
              <ProfilePreview
                session={session}
                photoUrl={headerPhotoUrl}
                onChangePhoto={() => setTab("account")}
              />
            )}
            <div className="brand">OpenBook</div>
          </div>
          {session ? (
            <GroupSwitcher
              session={session}
              config={config}
              myGroups={myGroups}
              onSwitch={switchGroup}
              onRemove={removeGroup}
              onAddGroup={() => setShowAddGroup(true)}
            />
          ) : (
            <div className="muted small">Your group's honest record.</div>
          )}
        </div>
        {session && (
          <div className="header-right">
            <NotificationBell items={notifications.items} urgent={pendingConfirmCount > 0} />
            {session.role === "admin" && (
              <button
                className="btn-ghost calc-icon-btn payment-review-icon-btn"
                onClick={() => setTab("reconciliation")}
                aria-label={
                  pendingConfirmCount > 0
                    ? `Payment Review — ${pendingConfirmCount} pending confirmation${pendingConfirmCount === 1 ? "" : "s"}`
                    : "Payment Review"
                }
                title="Payment Review"
              >
                <Icon name="check" size={16} className="icon-inline" /> <span className="calc-icon-label">Review</span>
                {pendingConfirmCount > 0 && (
                  <span className="notification-bell-badge notification-bell-badge-urgent">
                    {pendingConfirmCount > 9 ? "9+" : pendingConfirmCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost header-icon-btn"
              onClick={() => setShowCalculator(true)}
              aria-label="Open calculator"
              title="Calculator"
            >
              <Icon name="calculator" size={18} />
            </button>
          </div>
        )}
      </header>

      <OfflineBanner online={online} pending={pendingSyncCount} syncing={syncing} />

      {showCalculator && <QuickCalculator onClose={() => setShowCalculator(false)} />}
      {showWalkthrough && (
        <Walkthrough session={session} onClose={() => setShowWalkthrough(false)} />
      )}
      {showAddGroup && (
        <AddGroupModal onJoin={join} onLogin={login} onClose={() => setShowAddGroup(false)} />
      )}

      <main className="app-main">
        {!session ? (
          <Login
            onLogin={handleLogin}
            onJoin={handleJoin}
            onCreateGroup={handleDevCreateGroup}
            onOwnerLogin={handleOwnerLogin}
            sessionEndedNotice={sessionEndedNotice}
          />
        ) : onboarding.needsOnboarding ? (
          <Onboarding
            groupName={session.groupName}
            groupDefaultRate={config.schedule.find((r) => !isRecipientRow(r))?.due}
            onComplete={handleFinishOnboarding}
            onSkip={onboarding.skip}
          />
        ) : (
          <>
            {tab !== "home" && (
              <div className="dashboard-greeting">
                <span className="greeting-emoji">👋</span> {greeting()}, <strong>{genderedAddress(session.gender)}{session.name}</strong>
                {session.role && (
                  <span className={"tag" + (session.role === "admin" ? " tag-rate" : "")} style={{ marginLeft: 8 }}>
                    {session.role}
                  </span>
                )}
              </div>
            )}

            <div className="nav-row">
              <DesktopTabBar activeId={tab} onSelect={setTab} />
              <NavMenu
                items={TABS.filter((t) => !t.adminOnly || session.role === "admin").map((t) =>
                  t.id === "receipts" ? { ...t, badge: receipts.unseenCount } : t
                )}
                activeId={tab}
                onSelect={setTab}
                onOpenWalkthrough={() => setShowWalkthrough(true)}
                theme={theme}
                onToggleTheme={toggleTheme}
                open={navMenuOpen}
                onToggle={() => setNavMenuOpen((o) => !o)}
                onClose={() => setNavMenuOpen(false)}
              />
            </div>

            {tab === "home" && (
              <>
                <PlatformMessageBanner />
                <SubscriptionExpiryBanner
                  status={subscription.status}
                  isAdmin={session.role === "admin"}
                  groupSlug={session.groupSlug}
                  onUpgrade={() => setTab("subscription")}
                />
                <Dashboard
                  session={session}
                  config={config}
                  ledger={ledger}
                  totals={totals}
                  onOpenReconciliation={session.role === "admin" ? () => setTab("reconciliation") : undefined}
                  onOpenLedger={() => setTab("ledger")}
                  onOpenGroupSetup={session.role === "admin" ? () => setTab("setup") : undefined}
                  onOpenPaymentOptions={() => setTab("payment-options")}
                  onOpenCommunity={() => setTab("community")}
                  onLogPayment={openLedgerToPay}
                />
              </>
            )}

            {tab !== "home" && (
              <button className="btn-link back-link" onClick={() => setTab("home")}>← Back to Home</button>
            )}

            {tab === "ledger" && (
              <div className="panel" role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger">
                <h2 className="panel-title">
                  My Payment History <span className="muted tiny">(Ledger)</span>
                </h2>
                <PaymentInfo paymentMethods={config.paymentMethods} />

                {config.schedule.length === 0 ? (
                  <p className="muted small" style={{ padding: "20px 0" }}>
                    No payout dates are set up yet. A group leader can add them from Group Setup.
                  </p>
                ) : (
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
                    premiumActive={subscription.status?.active}
                    focusRowId={focusPaymentRowId}
                    onFocusHandled={() => setFocusPaymentRowId(null)}
                  />
                )}

                <div className="payout-block">
                  <h3 className="panel-subtitle">Your Turn's Payout</h3>
                  <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>
                    Record here when this member receives their group payout for this round — not a regular contribution.
                  </p>
                  <div className="field-row">
                    <label className="field">
                      Amount (K)
                      <input
                        type="number"
                        value={ledger.payoutInfo?.amount || 0}
                        onChange={(e) => updatePayout("amount", e.target.value)}
                        onBlur={confirmPayoutAmountSaved}
                      />
                    </label>
                    <label className="field">
                      Date received
                      <input
                        type="date"
                        value={ledger.payoutInfo?.date || ""}
                        onChange={(e) => updatePayoutAndConfirm("date", e.target.value)}
                      />
                    </label>
                  </div>
                  <Toast message={payoutStatus} />

                  <table className="summary-table">
                    <tbody>
                      <tr><td>Your Turn's Payout</td><td className="ar">{money(ledger.payoutInfo?.amount)}</td></tr>
                      <tr><td>Total Paid to Date</td><td className="ar">{money(totals.paid)}</td></tr>
                      <tr className={totals.net > 0 ? "neg" : "pos"}>
                        <td>Balance After Payout (Payout − Paid)</td><td className="ar">{money(totals.net)}</td>
                      </tr>
                      <tr><td>What You Still Owe</td><td className="ar">{money(totals.balance)}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="privacy-row">
                  <button className="btn-link" onClick={handleDeleteData}>Delete my data</button>
                </div>
              </div>
            )}

            {tab === "receipts" && (
              <div className="panel" role="tabpanel" id="panel-receipts" aria-labelledby="tab-receipts">
                <h2 className="panel-title">My Receipts</h2>
                <MyReceipts
                  receipts={receipts.receipts}
                  memberName={session.name}
                  groupName={config.groupName}
                  cycleName={config.cycleName}
                  premiumActive={subscription.status?.active}
                  onUpgrade={() => setTab("subscription")}
                />
              </div>
            )}

            {tab === "payment-options" && (
              <div role="tabpanel" id="panel-payment-options" aria-labelledby="tab-payment-options">
                <PaymentOptions session={session} config={config} onSaved={setConfig} />
              </div>
            )}

            {tab === "summary" && (
              <div className="panel" role="tabpanel" id="panel-summary" aria-labelledby="tab-summary">
                <h2 className="panel-title">Payment Summary</h2>
                <p className="muted tiny" style={{ marginBottom: 14 }}>
                  A read-only summary of your own contribution totals — not the calculator
                  (that's the calculator icon in the header).
                </p>
                <div className="vital-primary">
                  <div className="vital-card-label">What You Still Owe</div>
                  <div className={"vital-primary-value" + (totals.balance > 0 ? " vital-card-value-warn" : " vital-card-value-ok")}>
                    {money(totals.balance)}
                  </div>
                </div>
                <div className="vital-secondary-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <MiniStat label="Should Have Paid So Far" value={money(totals.due)} />
                  <MiniStat label="Paid So Far" value={money(totals.paid)} />
                  <MiniStat label="Your Turn's Payout" value={money(ledger.payoutInfo?.amount)} />
                  <MiniStat label="Balance After Payout" value={money(totals.net)} warn={totals.net > 0} />
                  <MiniStat
                    label="Suggested per Remaining Date"
                    value={totals.remainingCount > 0 ? money(totals.suggestedRate) : "—"}
                  />
                </div>
              </div>
            )}

            {tab === "setup" && session.role === "admin" && (
              <div role="tabpanel" id="panel-setup" aria-labelledby="tab-setup">
                <GroupSetup
                  config={config}
                  onSaved={setConfig}
                  session={session}
                  premiumActive={subscription.status?.active}
                  onOpenPaymentOptions={() => setTab("payment-options")}
                />
              </div>
            )}

            {tab === "reconciliation" && session.role === "admin" && (
              <div role="tabpanel" id="panel-reconciliation" aria-labelledby="tab-reconciliation">
                <Reconciliation
                  config={config}
                  premiumActive={subscription.status?.active}
                  onOpenGroupSetup={() => setTab("setup")}
                />
              </div>
            )}

            {tab === "loans" && session.role === "admin" && (
              <div role="tabpanel" id="panel-loans" aria-labelledby="tab-loans"><Loans /></div>
            )}

            {tab === "reminders" && (
              <div role="tabpanel" id="panel-reminders" aria-labelledby="tab-reminders">
                <Reminders config={config} premiumActive={subscription.status?.active} />
              </div>
            )}

            {tab === "community" && (
              <div role="tabpanel" id="panel-community" aria-labelledby="tab-community">
                <Community schedule={config.schedule} currentMemberName={session.name} isAdmin={session.role === "admin"} />
              </div>
            )}

            {tab === "subscription" && (
              <div role="tabpanel" id="panel-subscription" aria-labelledby="tab-subscription">
                {session.role === "admin" ? (
                  <Subscription status={subscription.status} onPaid={subscription.refresh} />
                ) : (
                  <SubscriptionGate status={subscription.status} />
                )}
              </div>
            )}

            {tab === "account" && (
              <div role="tabpanel" id="panel-account" aria-labelledby="tab-account">
                <Profile
                  session={session}
                  onRenamed={renameSession}
                  onLogout={handleLogout}
                  subscriptionStatus={subscription.status}
                  onUpgrade={() => setTab("subscription")}
                />
              </div>
            )}

            {tab === "tools" && (
              <div role="tabpanel" id="panel-tools" aria-labelledby="tab-tools">
                <ToolsPanel theme={theme} onToggleTheme={toggleTheme} />
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

      {session && !onboarding.needsOnboarding && (
        <BottomTabBar
          activeId={tab}
          onSelect={(id) => {
            setTab(id);
            setNavMenuOpen(false);
          }}
          onOpenMenu={() => setNavMenuOpen((o) => !o)}
          menuOpen={navMenuOpen}
          hasMenuBadge={receipts.unseenCount > 0}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, warn }) {
  return (
    <div className="vital-secondary">
      <div className="vital-card-label">{label}</div>
      <div className={"vital-secondary-value" + (warn ? " vital-card-value-warn" : "")}>{value}</div>
    </div>
  );
}
