/**
 * A basic fraud signal for the owner dashboard: the same creation
 * fingerprint (IP address, or the optional phone number an admin gave
 * when creating a group) showing up on more than one group within a
 * short window — someone spinning up several free-tier groups quickly
 * to dodge the member cap, rather than one legitimate group being
 * created once. Pure — takes plain group rows and "now" isn't even
 * needed, just each group's own createdAt — so it's testable without a
 * database.
 *
 * Deliberately not proof of anything — a shared office/family WiFi IP
 * or a shared household phone can trigger this too. It's a signal for
 * the owner to look at, not an automatic suspension (see routes/owner.js,
 * which only ever suspends a group when an owner explicitly says to).
 *
 * @param {Array<{id, groupName, createdAt, createdIp, createdByPhone}>} groups
 * @param {number} [windowHours] - how close together counts as "a short window"
 * @returns {Array<{type: 'ip'|'phone', value, groups: Array<{id, groupName, createdAt}>}>}
 */
export function detectSharedSignalFraud(groups, windowHours = 48) {
  const windowMs = windowHours * 60 * 60 * 1000;
  const signals = [];

  for (const [field, type] of [["createdIp", "ip"], ["createdByPhone", "phone"]]) {
    const byValue = new Map();
    for (const g of groups || []) {
      const v = g[field];
      if (!v) continue;
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(g);
    }

    for (const [value, list] of byValue) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const clustered = sorted.some(
        (g, i) => i > 0 && new Date(g.createdAt) - new Date(sorted[i - 1].createdAt) <= windowMs
      );
      if (clustered) {
        signals.push({
          type,
          value,
          groups: sorted.map((g) => ({ id: g.id, groupName: g.groupName, createdAt: g.createdAt })),
        });
      }
    }
  }

  return signals;
}
