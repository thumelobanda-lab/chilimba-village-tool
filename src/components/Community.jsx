import React from "react";
import { getGroupFunds } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Community() {
  const { data, error, loading } = useApiData(getGroupFunds, []);

  return (
    <div className="panel">
      <h2 className="panel-title">Community</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Fund balances, recent settlements, and any loans against a loanable fund — visible
        to everyone in the group, the way a shared ledger works. This shows names, amounts,
        and dates only — never anyone's full payment history or balance.
      </p>

      {error && <div className="error-text" role="alert">{error}</div>}
      {loading && !data && <p className="muted small" aria-live="polite">Loading…</p>}

      {data && (
        <>
          <div className="calc-grid" style={{ marginBottom: 20 }}>
            {data.funds.map((f) => (
              <div className="card" key={f.id}>
                <div className="card-label">{f.name}</div>
                <div className="card-value">{money(f.loanable ? f.available : f.balance)}</div>
                <div className="muted tiny">
                  {f.loanable
                    ? `${money(f.balance)} collected · ${money(f.outstandingLoans)} out on loan`
                    : `K${f.amount} per member per date`}
                </div>
              </div>
            ))}
            {data.funds.length === 0 && (
              <p className="muted small">No community funds are set up yet.</p>
            )}
          </div>

          {data.loans && data.loans.length > 0 && (
            <>
              <h3 className="panel-subtitle">Loans</h3>
              <div className="feed-list" style={{ marginBottom: 20 }}>
                {data.loans.map((l) => (
                  <div className="feed-item" key={l.id}>
                    <span className="feed-name">{l.borrowerName}</span>
                    <span className="muted small">
                      borrowed {money(l.amount)} from {l.fundName}
                    </span>
                    {l.status === "outstanding" ? (
                      <span className="status-outstanding">Outstanding</span>
                    ) : (
                      <span className="status-paid">Repaid</span>
                    )}
                    <span className="muted tiny">{timeAgo(l.issuedAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="panel-subtitle">Recent activity</h3>
          <div className="feed-list">
            {data.feed.length === 0 && <p className="muted small">No settlements recorded yet.</p>}
            {data.feed.map((entry) => (
              <div className="feed-item" key={entry.id}>
                <span className="feed-name">{entry.displayName}</span>
                <span className="muted small">
                  settled {entry.scheduleGroup} ({entry.scheduleDate}) — {entry.fundName} +{money(entry.amount)}
                </span>
                <span className="muted tiny">{timeAgo(entry.recordedAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
