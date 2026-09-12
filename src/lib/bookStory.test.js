import { describe, expect, it } from "vitest";
import { buildBookStoryStats, closingMessage, isFlawlessCycle, longestGroupStreak, longestRun } from "./bookStory.js";

const onTime = (n) => Array.from({ length: n }, () => ({ status: "on-time" }));

describe("longestRun", () => {
  it("counts a simple all-on-time run", () => {
    expect(longestRun(onTime(5))).toBe(5);
  });

  it("treats 'late' as continuing the run, same as computeMemberStreak's currentStreak rule", () => {
    expect(longestRun([{ status: "on-time" }, { status: "late" }, { status: "on-time" }])).toBe(3);
  });

  it("a 'missed' dot breaks the run", () => {
    expect(longestRun([{ status: "on-time" }, { status: "on-time" }, { status: "missed" }, { status: "on-time" }])).toBe(2);
  });

  it("returns the LONGEST run, not just the one ending at the last dot", () => {
    // 3-run, then missed, then a shorter 1-run at the very end.
    const dots = [...onTime(3), { status: "missed" }, { status: "on-time" }];
    expect(longestRun(dots)).toBe(3);
  });

  it("empty/undefined input is zero", () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun(undefined)).toBe(0);
  });
});

describe("longestGroupStreak", () => {
  it("picks the best run across every member without naming who", () => {
    const dotsByMember = {
      Alice: onTime(2),
      Bob: onTime(7),
      Carol: [{ status: "missed" }, ...onTime(1)],
    };
    expect(longestGroupStreak(dotsByMember)).toBe(7);
  });

  it("handles an empty group", () => {
    expect(longestGroupStreak({})).toBe(0);
  });
});

describe("isFlawlessCycle", () => {
  it("true only when every judged dot across every member is on-time", () => {
    expect(isFlawlessCycle({ Alice: onTime(3), Bob: onTime(2) })).toBe(true);
  });

  it("false if even one dot, anywhere, was late", () => {
    expect(isFlawlessCycle({ Alice: onTime(3), Bob: [...onTime(1), { status: "late" }] })).toBe(false);
  });

  it("false if even one dot was missed", () => {
    expect(isFlawlessCycle({ Alice: onTime(3), Bob: [{ status: "missed" }] })).toBe(false);
  });

  it("false with no data at all — never claim flawless with nothing to judge", () => {
    expect(isFlawlessCycle({})).toBe(false);
    expect(isFlawlessCycle({ Alice: [] })).toBe(false);
  });
});

describe("closingMessage", () => {
  it("flawless takes priority over score, even at a very high score", () => {
    expect(closingMessage({ grs: { score: 99 }, flawless: true })).toMatch(/Nobody missed a beat/);
  });

  it("a high score that is NOT literally flawless gets the strong tier, not the flawless claim", () => {
    const msg = closingMessage({ grs: { score: 95 }, flawless: false });
    expect(msg).not.toMatch(/Nobody missed a beat/);
    expect(msg).toMatch(/steady, reliable/);
  });

  it("mid score gets the mixed tier", () => {
    expect(closingMessage({ grs: { score: 60 }, flawless: false })).toMatch(/bumps along the way/);
  });

  it("low score still lands on something true and positive, not just negative", () => {
    const msg = closingMessage({ grs: { score: 20 }, flawless: false });
    expect(msg).toMatch(/circle held/);
    expect(msg).toMatch(/everyone got paid/);
  });

  it("null score (not enough sample) gets a neutral first-rotation line", () => {
    expect(closingMessage({ grs: { score: null }, flawless: false })).toMatch(/first rotation/);
  });
});

describe("buildBookStoryStats", () => {
  it("assembles a consistent stats object a flawless cycle would produce", () => {
    const stats = buildBookStoryStats({
      groupName: "Hillcrest Chilimba",
      cycleName: "Cycle 1",
      totalContributed: 12500,
      totalActiveMembers: 5,
      grs: { score: 100, sampleSize: 15 },
      dotsByMember: { Alice: onTime(3), Bob: onTime(3), Carol: onTime(3), Dan: onTime(3), Eve: onTime(3) },
    });
    expect(stats).toMatchObject({
      groupName: "Hillcrest Chilimba",
      totalContributed: 12500,
      totalActiveMembers: 5,
      longestStreak: 3,
      flawless: true,
      closingLine: "Nobody missed a beat this round.",
    });
  });

  it("assembles a consistent stats object a rough cycle would produce", () => {
    const stats = buildBookStoryStats({
      groupName: "Hillcrest Chilimba",
      cycleName: "Cycle 1",
      totalContributed: 8000,
      totalActiveMembers: 5,
      grs: { score: 35, sampleSize: 15 },
      dotsByMember: {
        Alice: [{ status: "missed" }, { status: "missed" }, { status: "on-time" }],
        Bob: [{ status: "late" }, { status: "missed" }, { status: "on-time" }],
      },
    });
    expect(stats.flawless).toBe(false);
    expect(stats.closingLine).toMatch(/circle held/);
    expect(stats.longestStreak).toBe(1);
  });
});
