import { describe, it, expect, beforeEach } from "vitest";
import {
  MILESTONE_IMAGES,
  pickMilestoneImage,
  resolveMilestoneEvent,
  hasSeenMilestone,
  markMilestoneSeen,
} from "./milestones.js";

// No jsdom in this suite (see vite.config.js) — a minimal in-memory
// localStorage stand-in is enough to exercise the seen/dismiss logic.
beforeEach(() => {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("pickMilestoneImage", () => {
  it("only ever returns one of the four milestone images", () => {
    for (let i = 0; i < 200; i++) {
      const picked = pickMilestoneImage();
      expect(MILESTONE_IMAGES).toContain(picked);
    }
  });

  it("picks every image across the random range, not just one", () => {
    expect(pickMilestoneImage(() => 0)).toBe(MILESTONE_IMAGES[0]);
    expect(pickMilestoneImage(() => 0.26)).toBe(MILESTONE_IMAGES[1]);
    expect(pickMilestoneImage(() => 0.51)).toBe(MILESTONE_IMAGES[2]);
    expect(pickMilestoneImage(() => 0.76)).toBe(MILESTONE_IMAGES[3]);
  });

  it("never falls off the end for a rand() right at 1", () => {
    expect(pickMilestoneImage(() => 0.999999)).toBe(MILESTONE_IMAGES[3]);
  });
});

describe("resolveMilestoneEvent", () => {
  const schedule = [
    { id: "a", date: "2026-08-06", payees: ["Harriet"] },
    { id: "b", date: "2026-08-20", payees: ["Fridah"] }, // the schedule's last date
  ];

  it("shows for a genuine payout-confirmation event", () => {
    const event = resolveMilestoneEvent(schedule, "2026-08-06");
    expect(event).toEqual({ row: schedule[0], cycleComplete: false });
  });

  it("flags cycleComplete when the recent payout is also the cycle's last date", () => {
    const event = resolveMilestoneEvent(schedule, "2026-08-20");
    expect(event).toEqual({ row: schedule[1], cycleComplete: true });
  });

  it("doesn't show for an unrelated event — no recent payout at all", () => {
    expect(resolveMilestoneEvent(schedule, "2026-09-15")).toBeNull();
    expect(resolveMilestoneEvent([], "2026-08-20")).toBeNull();
  });
});

describe("hasSeenMilestone / markMilestoneSeen", () => {
  it("is unseen until explicitly marked", () => {
    expect(hasSeenMilestone("hillcrest", "b")).toBe(false);
    markMilestoneSeen("hillcrest", "b");
    expect(hasSeenMilestone("hillcrest", "b")).toBe(true);
  });

  it("doesn't show again after dismissal — seen state persists per group + event", () => {
    markMilestoneSeen("hillcrest", "b");
    expect(hasSeenMilestone("hillcrest", "b")).toBe(true);
    // A different event (a different payout row) is unaffected.
    expect(hasSeenMilestone("hillcrest", "c")).toBe(false);
    // A different group's copy of the same row id is also unaffected.
    expect(hasSeenMilestone("riverside", "b")).toBe(false);
  });
});
