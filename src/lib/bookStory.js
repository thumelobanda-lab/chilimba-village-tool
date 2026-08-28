/**
 * Pure logic behind "Your Book's Story" — the celebratory recap shown
 * when a full payout rotation completes. Composes the same aggregate
 * building blocks the rest of the app already trusts (GRS from
 * reliability.js, per-member streak dots from streakMath.js) rather
 * than re-deriving reliability rules a second time. Kept
 * dependency-free and colocated with a test file, same discipline as
 * dashboardMath.js/reliability.js.
 */

/**
 * The longest run of consecutive non-"missed" dots in one member's own
 * streak history — their single best stretch during the cycle, not
 * just whatever their streak happens to be at the very last date (a
 * member could have had a long great run earlier and one late payment
 * right at the end; this is meant to be a genuinely celebratory number,
 * not one that gets zeroed out by exactly where the cycle happened to
 * land). Mirrors computeMemberStreak's own rule that a "late" dot keeps
 * a streak alive — only a genuine "missed" breaks it.
 *
 * @param {Array<{status: 'on-time'|'late'|'missed'}>} dots
 * @returns {number}
 */
export function longestRun(dots) {
  let best = 0;
  let current = 0;
  for (const dot of dots || []) {
    if (dot.status === "missed") {
      current = 0;
      continue;
    }
    current++;
    if (current > best) best = current;
  }
  return best;
}

/**
 * The single longest streak achieved by ANY member across the whole
 * group — an aggregate figure only, never which member achieved it,
 * same privacy discipline computeGroupPulse (dashboardPulse.js) already
 * holds for the regular contribution ledger.
 *
 * @param {Object<string, Array<{status: string}>>} dotsByMember - memberName -> that member's streak dots
 * @returns {number}
 */
export function longestGroupStreak(dotsByMember) {
  let best = 0;
  for (const dots of Object.values(dotsByMember || {})) {
    const run = longestRun(dots);
    if (run > best) best = run;
  }
  return best;
}

/**
 * Whether literally every judged payment across the whole group was
 * on-time — the one and only condition allowed to produce the "Nobody
 * missed a beat" closing line (see closingMessage below). A high GRS
 * score alone is not enough: GRS averages on-time=1/late=0.5/missed=0,
 * so a group could score 90+ with an occasional late payment mixed in.
 * This is checked directly so that specific claim can never overstate
 * what actually happened.
 *
 * @param {Object<string, Array<{status: string}>>} dotsByMember
 * @returns {boolean}
 */
export function isFlawlessCycle(dotsByMember) {
  const allDots = Object.values(dotsByMember || {}).flat();
  if (allDots.length === 0) return false;
  return allDots.every((d) => d.status === "on-time");
}

/**
 * The recap's one closing line — tone keyed to the group's actual
 * performance, mirroring GroupReliabilityScore.jsx's existing GRS
 * tiers (>=80 good, >=50 ok, below that low) so the recap never
 * disagrees with what the dashboard already told this group about
 * itself. `flawless` is checked first since it's a stricter, exact
 * condition a high score alone doesn't guarantee (see isFlawlessCycle).
 * Even the roughest tier leads with something true and positive — the
 * rotation completed, everyone got paid — rather than dwelling on the
 * number, per the "warm and honest, not falsely celebratory" brief.
 *
 * @param {{grs: {score: number|null}, flawless: boolean}} params
 * @returns {string}
 */
export function closingMessage({ grs, flawless }) {
  if (flawless) return "Nobody missed a beat this round 🎉";
  if (grs?.score == null) return "Your group's first rotation is complete — here's how it went.";
  if (grs.score >= 80) return "A steady, reliable round — the group showed up for each other 💛";
  if (grs.score >= 50) return "A few bumps along the way, but the group pulled through.";
  return "This round had its challenges — but the circle held, and everyone got paid.";
}

/**
 * Assembles the recap's full stat set from the same aggregate figures
 * Group Pulse already computes (getGroupPulse in lib/api/dashboard.js)
 * plus the group-wide longest streak above — the single object
 * BookStory.jsx and bookStoryCard.js (the shareable-image renderer)
 * both render from, so the two can never drift out of sync with each
 * other.
 *
 * @param {object} params
 * @param {string} params.groupName
 * @param {string} params.cycleName
 * @param {number} params.totalContributed
 * @param {number} params.totalActiveMembers
 * @param {{score: number|null, sampleSize: number}} params.grs
 * @param {Object<string, Array<{status: string}>>} params.dotsByMember
 * @returns {object}
 */
export function buildBookStoryStats({ groupName, cycleName, totalContributed, totalActiveMembers, grs, dotsByMember }) {
  const flawless = isFlawlessCycle(dotsByMember);
  return {
    groupName,
    cycleName,
    totalContributed,
    totalActiveMembers,
    grs,
    longestStreak: longestGroupStreak(dotsByMember),
    flawless,
    closingLine: closingMessage({ grs, flawless }),
  };
}
