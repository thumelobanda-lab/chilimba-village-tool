/**
 * Pure helpers behind the home dashboard's "vital records" — cycle
 * progress (how far through the schedule the group is), a plain-language
 * label for how far away a due date is, and the community fund grand
 * total. Kept dependency-free and colocated with a test file, same as
 * ledgerMath.js, so the date arithmetic is verified without rendering
 * Dashboard.jsx.
 */

/**
 * How far through the current schedule the group is — a payout date
 * counts as "passed" once its date has arrived, regardless of whether
 * every member has actually paid for it (that's what Outstanding
 * Balance is for; this is progress through the rotation itself).
 *
 * @param {Array<{date: string}>} schedule
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today; a param
 *   so this stays testable without mocking the system clock.
 * @returns {{ total: number, passed: number, percent: number }}
 */
export function computeCycleProgress(schedule, todayISO = new Date().toISOString().slice(0, 10)) {
  const total = schedule.length;
  if (total === 0) return { total: 0, passed: 0, percent: 0 };

  const today = new Date(todayISO + "T00:00:00");
  const passed = schedule.filter((row) => {
    const d = new Date(row.date + "T00:00:00");
    return !isNaN(d.getTime()) && d <= today;
  }).length;

  return { total, passed, percent: Math.round((passed / total) * 100) };
}

/**
 * Whole days between today and a due date — negative once it's overdue.
 * Appending "T00:00:00" (no "Z") keeps both dates in local time, matching
 * generateScheduleDates' rationale in scheduleUtils.js.
 *
 * @param {string} dateISO - "YYYY-MM-DD"
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today
 * @returns {number}
 */
export function daysUntil(dateISO, todayISO = new Date().toISOString().slice(0, 10)) {
  const target = new Date(dateISO + "T00:00:00");
  const today = new Date(todayISO + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

/** Plain-language version of daysUntil()'s output, for the dashboard card. */
export function relativeDueLabel(days) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days} days`;
}

/**
 * Per-date payout status across the whole schedule, for the cycle
 * timeline — each row tagged "past" (that date's payout has happened),
 * "next" (the soonest date still ahead — exactly one row, the first
 * future date), or "future" (everyone else still waiting).
 *
 * Deliberately built only from the schedule's own dates, not from
 * anyone's actual payment/payout records — the app has no cross-member
 * "payout confirmed received" data to check (only a member's own ledger
 * has that), and querying every member's ledger just to render a
 * dashboard timeline would be exactly the kind of extra round-trip that
 * breaks the "instant, no lag" requirement this exists to meet. "Past"
 * here means "that date has arrived", same assumption computeCycleProgress
 * above already makes — an honest proxy, not a verified receipt.
 *
 * @param {Array<{id: string, date: string}>} schedule
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today
 * @returns {Array<object>} schedule rows, each with an added `status` field
 */
export function buildCycleTimeline(schedule, todayISO = new Date().toISOString().slice(0, 10)) {
  const today = new Date(todayISO + "T00:00:00");
  let markedNext = false;

  return schedule.map((row) => {
    const d = new Date(row.date + "T00:00:00");
    const isPast = !isNaN(d.getTime()) && d <= today;
    if (isPast) return { ...row, status: "past" };
    if (!markedNext) {
      markedNext = true;
      return { ...row, status: "next" };
    }
    return { ...row, status: "future" };
  });
}

/**
 * The community fund headline total — gross balance across every fund
 * (not "available", which nets out loans against loanable funds; the
 * dashboard's figure is meant to read as "what the group has raised
 * together", same quantity Community.jsx labels "collected" per fund).
 *
 * @param {Array<{balance: number}>} funds
 * @returns {number}
 */
export function sumFundBalances(funds) {
  return (funds || []).reduce((sum, f) => sum + (Number(f.balance) || 0), 0);
}
