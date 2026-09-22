import { describe, it, expect, beforeEach } from "vitest";
import { spotlightTourSeenKey, hasSeenSpotlightTour } from "./SpotlightTour.jsx";

// No jsdom in this project's test setup (see vite.config.js) — a minimal
// in-memory stand-in is enough to exercise the get/set logic being
// tested here.
function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    clear: () => store.clear(),
  };
}

const session = { groupSlug: "hillcrest", name: "Harriet" };

describe("spotlight tour seen tracking", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    localStorage.clear();
  });

  it("builds a key scoped to both the group and the member", () => {
    const key = spotlightTourSeenKey(session);
    expect(key).toContain("hillcrest");
    expect(key).toContain("harriet");
  });

  it("is unseen by default", () => {
    expect(hasSeenSpotlightTour(session)).toBe(false);
  });

  it("is seen once the key is set", () => {
    localStorage.setItem(spotlightTourSeenKey(session), "1");
    expect(hasSeenSpotlightTour(session)).toBe(true);
  });

  it("is scoped separately per group — seeing it in one group doesn't mark it seen in another", () => {
    localStorage.setItem(spotlightTourSeenKey(session), "1");
    const otherGroupSession = { groupSlug: "kanyama", name: "Harriet" };
    expect(hasSeenSpotlightTour(otherGroupSession)).toBe(false);
  });

  it("does not throw and reports unseen when there's no session", () => {
    expect(() => hasSeenSpotlightTour(null)).not.toThrow();
    expect(hasSeenSpotlightTour(null)).toBe(false);
  });
});
