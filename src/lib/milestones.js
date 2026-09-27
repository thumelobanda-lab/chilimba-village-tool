import { findRecentPayout } from "./dashboardMath.js";
import { cycleEndDate } from "./scheduleUtils.js";

// Four self-hosted photos (public/images/milestones/) — credited in
// Profile.jsx's photo-credit line in this same order: Lukáš Kadava,
// Akash Ghosh, Peter Robbins, Ethan Dow. Actual dimensions from the
// downloaded files, so MilestoneMoment.jsx can set width/height up
// front and reserve the right aspect ratio before the image loads.
export const MILESTONE_IMAGES = [
  { file: "milestone-wheat.webp", alt: "Golden wheat field at sunset", width: 1000, height: 750 },
  { file: "milestone-flowers.webp", alt: "Golden mustard flower field at sunrise", width: 1000, height: 667 },
  { file: "milestone-plant.webp", alt: "Close-up of plants at sunrise", width: 1000, height: 750 },
  { file: "milestone-hills.webp", alt: "Rolling hills under a dramatic sky", width: 1000, height: 668 },
];

// rand is injectable so tests can force each quartile deterministically
// instead of relying on real randomness.
export function pickMilestoneImage(rand = Math.random) {
  const idx = Math.min(Math.floor(rand() * MILESTONE_IMAGES.length), MILESTONE_IMAGES.length - 1);
  return MILESTONE_IMAGES[idx];
}

/**
 * The payout-day milestone moment's trigger — a payout was just
 * confirmed (reuses findRecentPayout, the same "just happened" signal
 * PayoutAcknowledgment already shows a plainer banner for), plus
 * whether that same payout also completes the cycle (its date is the
 * schedule's last one, from cycleEndDate). Returns null on any day with
 * no recent payout, so an unrelated event (opening the app on an
 * ordinary day) never matches.
 *
 * @param {Array<object>} schedule
 * @param {string} [todayISO]
 * @param {number} [windowDays]
 * @returns {{row: object, cycleComplete: boolean}|null}
 */
export function resolveMilestoneEvent(schedule, todayISO, windowDays) {
  const row = findRecentPayout(schedule, todayISO, windowDays);
  if (!row) return null;
  return { row, cycleComplete: row.date === cycleEndDate(schedule) };
}

function milestoneSeenKey(groupSlug, rowId) {
  return `chilimba:seen-milestone:${groupSlug}:${rowId}`;
}

// Marked seen the moment the moment is actually shown (see
// MilestoneMoment.jsx), not just on explicit dismiss — so navigating
// away without tapping "Dismiss" still counts as having seen it once.
export function hasSeenMilestone(groupSlug, rowId) {
  return localStorage.getItem(milestoneSeenKey(groupSlug, rowId)) === "1";
}

export function markMilestoneSeen(groupSlug, rowId) {
  localStorage.setItem(milestoneSeenKey(groupSlug, rowId), "1");
}
