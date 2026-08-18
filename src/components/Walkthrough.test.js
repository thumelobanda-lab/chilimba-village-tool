import { describe, it, expect, beforeEach } from "vitest";
import { walkthroughSeenKey, hasSeenWalkthrough } from "./Walkthrough.jsx";

// No jsdom in this project's test setup (see vite.config.js), so
// localStorage isn't a real global here — a minimal in-memory stand-in
// is enough to exercise the get/set logic being tested.
function installFakeLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    clear: () => store.clear(),
  };
}

const session = { groupSlug: "hillcrest", name: "Harriet" };

describe("walkthrough seen tracking", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    localStorage.clear();
  });

  it("builds a key scoped to both the group and the member", () => {
    const key = walkthroughSeenKey(session);
    expect(key).toContain("hillcrest");
    expect(key).toContain("harriet");
  });

  it("is unseen by default", () => {
    expect(hasSeenWalkthrough(session)).toBe(false);
  });

  it("is seen once the key is set", () => {
    localStorage.setItem(walkthroughSeenKey(session), "1");
    expect(hasSeenWalkthrough(session)).toBe(true);
  });

  it("is scoped separately per group — seeing it in one group doesn't mark it seen in another", () => {
    localStorage.setItem(walkthroughSeenKey(session), "1");
    const otherGroupSession = { groupSlug: "kanyama", name: "Harriet" };
    expect(hasSeenWalkthrough(otherGroupSession)).toBe(false);
  });
});
