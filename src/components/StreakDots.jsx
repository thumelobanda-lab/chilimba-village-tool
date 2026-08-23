import React from "react";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { day: "numeric", month: "short" });
}

function statusLabel(status) {
  if (status === "on-time") return "paid on time";
  if (status === "late") return "paid, but late";
  return "missed";
}

/**
 * A member's own on-time payment history as a row of small dots — the
 * same inline-bullet sizing/spacing as LedgerTable.jsx's confirm-bulb
 * (this is a row of *dates*, not people, so the heavier avatar-circle
 * style from PayoutAvatarRow.jsx would be too heavy here). `rows` is
 * computeMemberStreak's output (streakMath.js) — purely presentational.
 */
export default function StreakDots({ dots, currentStreak }) {
  if (!dots || dots.length === 0) return null;

  return (
    <div className="streak-block">
      <div className="vital-card-label">Your Payment Streak</div>
      <p className="streak-summary">
        {currentStreak > 0
          ? `Current streak: ${currentStreak} date${currentStreak === 1 ? "" : "s"} in a row kept current`
          : "No current streak — the most recent due date was missed"}
      </p>
      <div className="streak-dot-row">
        {dots.map((d) => (
          <span
            key={d.date}
            className={`streak-dot streak-dot-${d.status}`}
            title={`${formatDate(d.date)} — ${statusLabel(d.status)}`}
          >
            ●
          </span>
        ))}
      </div>
    </div>
  );
}
