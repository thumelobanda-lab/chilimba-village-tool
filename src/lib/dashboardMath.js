/**
 * Pure helpers behind the home dashboard's "vital records" — cycle
 * progress (how far through the schedule the group is), a plain-language
 * label for how far away a due date is, and the community fund grand
 * total. Kept dependency-free and colocated with a test file, same as
 * ledgerMath.js, so the date arithmetic is verified without rendering
 * Dashboard.jsx.
 */

import { getPayees } from "./scheduleUtils.js";

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
 * future date), or "future" (everyone else still waiting). Returned in
 * chronological order regardless of the input order — GroupSetup's
 * "+ Add date" appends new rows to the end of the array rather than
 * inserting them in date order (same reason findNextDue in
 * scheduleUtils.js already sorts defensively before picking a "next"),
 * so trusting array order here would tag the wrong row "next" for any
 * schedule that's been hand-edited out of date order.
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
 * @returns {Array<object>} schedule rows in date order, each with an added `status` field
 */
export function buildCycleTimeline(schedule, todayISO = new Date().toISOString().slice(0, 10)) {
  const today = new Date(todayISO + "T00:00:00");
  const sorted = [...(schedule || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  let markedNext = false;

  return sorted.map((row) => {
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
 * The next `count` upcoming (not-yet-passed) dates across the whole
 * group, in chronological order — for the dashboard's "Upcoming"
 * section, so there's always something relevant to check even between
 * the signed-in member's own due dates. Takes buildCycleTimeline's
 * already-sorted, already-tagged output rather than re-deriving it —
 * Dashboard.jsx computes that once and both sections share it.
 *
 * @param {Array<object>} timelineRows - output of buildCycleTimeline
 * @param {number} [count]
 * @returns {Array<object>}
 */
export function upcomingDates(timelineRows, count = 3) {
  return (timelineRows || []).filter((row) => row.status !== "past").slice(0, count);
}

/**
 * The most recent payout date that just happened — within the last
 * `windowDays` days, inclusive of today — for a brief, one-time "group
 * pulse" acknowledgment. Naturally self-limits without needing separate
 * expiry tracking: once a date falls outside the window it simply stops
 * matching, though the caller still needs its own dismiss/seen tracking
 * (see PayoutAcknowledgment.jsx) for a member who checks the app more
 * than once within that window. Picks the single most recent match if
 * more than one date falls in the window, rather than array order.
 *
 * @param {Array<{id: string, date: string}>} schedule
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today
 * @param {number} [windowDays] - how many days back still counts as "just happened"
 * @returns {object|null} the schedule row, or null if none is recent enough
 */
export function findRecentPayout(schedule, todayISO = new Date().toISOString().slice(0, 10), windowDays = 2) {
  const today = new Date(todayISO + "T00:00:00");
  const windowStart = new Date(today.getTime() - windowDays * 86400000);

  const candidates = (schedule || []).filter((row) => {
    const d = new Date(row.date + "T00:00:00");
    return !isNaN(d.getTime()) && d <= today && d >= windowStart;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => new Date(b.date) - new Date(a.date));
  return candidates[0];
}

/**
 * Is the given member's payout turn within the next `lookahead` upcoming
 * dates? Used to decide whether the progress ring's "your turn is close"
 * glow should light up — checks position among the *upcoming* dates
 * rather than raw days-until, so a member due on the very next date
 * always qualifies regardless of how far apart this group's schedule
 * spaces dates.
 *
 * @param {Array<object>} timelineRows - output of buildCycleTimeline
 * @param {string} name - the viewing member's display name
 * @param {number} [lookahead]
 * @returns {boolean}
 */
export function isMemberTurnSoon(timelineRows, name, lookahead = 2) {
  if (!name) return false;
  const target = name.trim().toLowerCase();
  return (timelineRows || [])
    .filter((row) => row.status !== "past")
    .slice(0, lookahead)
    .some((row) => getPayees(row).some((p) => p.toLowerCase() === target));
}

/**
 * Is the cycle in its final stretch — few enough dates remaining that
 * it's worth calling out on the progress ring? Measured in dates
 * remaining rather than percent, so it means the same thing regardless
 * of how many total dates a given group's schedule has.
 *
 * @param {{ total: number, passed: number }} cycle - output of computeCycleProgress
 * @param {number} [remainingThreshold]
 * @returns {boolean}
 */
export function isCycleNearingCompletion(cycle, remainingThreshold = 1) {
  if (!cycle || cycle.total === 0) return false;
  return cycle.total - cycle.passed <= remainingThreshold;
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

/**
 * Time-of-day greeting shown in the app header and the dashboard hero —
 * one copy so the two never drift apart.
 *
 * @param {number} [hour] - defaults to the real local hour; parameterized for testability
 * @returns {string}
 */
export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * How much the signed-in member personally still owes across every
 * loan borrowed in their own name — the Dashboard's "Loan owed" card is
 * deliberately hidden entirely (not shown as K0) when this is zero, per
 * the same "don't show a zero that isn't news" principle as the payout
 * acknowledgment. Matches by name (case-insensitive), the same way
 * isRecipient/findNextDue already resolve "which member is this" —
 * loans carry no session-linked id, only the name typed in when the
 * admin issued it.
 *
 * @param {Array<{borrowerName: string, balance?: number, amount: number}>} loans
 * @param {string} name
 * @returns {number}
 */
export function myOutstandingLoanTotal(loans, name) {
  if (!name) return 0;
  const target = name.trim().toLowerCase();
  return (loans || [])
    .filter((l) => (l.borrowerName || "").trim().toLowerCase() === target)
    .reduce((sum, l) => sum + Math.max(0, Number(l.balance ?? l.amount) || 0), 0);
}

/**
 * The compact "where the rotation is right now" avatar strip: the last
 * couple of members who already received their payout this schedule,
 * then the next few coming up — always including the signed-in member
 * even if their own turn is further out than the top of the "upcoming"
 * slice, since the whole point is "so they can immediately spot
 * themselves" regardless of group size.
 *
 * Takes buildCycleTimeline's already-sorted, already-tagged output
 * (Dashboard.jsx computes that once for the timeline strip already) and
 * flattens it to one entry per member per date — a date can have up to
 * 3 payees, so this isn't a 1:1 map over rows.
 *
 * @param {Array<object>} timelineRows - output of buildCycleTimeline,
 *   each row {..., payees: string[], status: 'past'|'next'|'future'}
 * @param {string} currentMemberName
 * @param {{lastReceivedCount?: number, upcomingCount?: number}} [opts]
 * @returns {Array<{name: string, status: 'received'|'next'|'upcoming', date: string, isCurrentUser: boolean}>}
 */
export function buildPayoutAvatarRow(timelineRows, currentMemberName, opts = {}) {
  const { lastReceivedCount = 2, upcomingCount = 3 } = opts;
  if (!timelineRows || timelineRows.length === 0) return [];

  const flat = [];
  for (const row of timelineRows) {
    for (const name of row.payees || []) {
      flat.push({ name, date: row.date, rowStatus: row.status });
    }
  }

  const pastEntries = flat.filter((e) => e.rowStatus === "past");
  const upcomingEntries = flat.filter((e) => e.rowStatus !== "past");

  // Scan backward through past entries for the most recent unique
  // names, then restore chronological order for display.
  const received = [];
  const seenReceived = new Set();
  for (let i = pastEntries.length - 1; i >= 0 && received.length < lastReceivedCount; i--) {
    const e = pastEntries[i];
    const key = e.name.trim().toLowerCase();
    if (seenReceived.has(key)) continue;
    seenReceived.add(key);
    received.unshift(e);
  }

  const upcoming = [];
  const seenUpcoming = new Set();
  for (const e of upcomingEntries) {
    const key = e.name.trim().toLowerCase();
    if (seenUpcoming.has(key) || seenReceived.has(key)) continue;
    seenUpcoming.add(key);
    upcoming.push(e);
    if (upcoming.length >= upcomingCount) break;
  }

  const rows = [
    ...received.map((e) => ({ name: e.name, status: "received", date: e.date })),
    ...upcoming.map((e) => ({ name: e.name, status: e.rowStatus === "next" ? "next" : "upcoming", date: e.date })),
  ];

  if (currentMemberName) {
    const key = currentMemberName.trim().toLowerCase();
    const alreadyShown = rows.some((r) => r.name.trim().toLowerCase() === key);
    if (!alreadyShown) {
      const own = flat.find((e) => e.name.trim().toLowerCase() === key);
      if (own) {
        rows.push({
          name: own.name,
          status: own.rowStatus === "past" ? "received" : own.rowStatus === "next" ? "next" : "upcoming",
          date: own.date,
        });
      }
    }
  }

  return rows.map((r) => ({
    ...r,
    isCurrentUser: !!currentMemberName && r.name.trim().toLowerCase() === currentMemberName.trim().toLowerCase(),
  }));
}
