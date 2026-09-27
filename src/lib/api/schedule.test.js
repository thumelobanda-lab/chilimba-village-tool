import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks core.js so this can run without a browser's localStorage —
// same approach as auth.test.js/profile.test.js. Exercises the mock-mode
// branch (MOCK_MODE = true, the app's own default) since that's what
// actually persists the group name here; the validation itself runs
// before the mock/real split, so it applies to both.
vi.mock("./core.js", () => ({
  MOCK_MODE: true,
  lsGet: vi.fn(),
  lsSet: vi.fn(),
  realFetch: vi.fn(),
  currentSession: vi.fn(),
  groupScopedKey: vi.fn((session, domain) => `chilimba:${domain}:${session.groupSlug}`),
}));

import { saveSchedule } from "./schedule.js";
import { lsGet, lsSet, currentSession } from "./core.js";

const adminSession = { name: "Harriet", role: "admin", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba", token: "t" };
const memberSession = { ...adminSession, role: "member" };
const baseSchedule = { groupName: "Hillcrest Chilimba", cycleName: "Cycle 1", schedule: [], funds: [] };

describe("saveSchedule — group name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession.mockReturnValue(adminSession);
    lsGet.mockReturnValue(null);
  });

  it("persists a rename so the next read returns the new name", async () => {
    await saveSchedule({ ...baseSchedule, groupName: "Riverside Chilimba" });
    expect(lsSet).toHaveBeenCalledWith(
      "chilimba:group:hillcrest",
      expect.objectContaining({ groupName: "Riverside Chilimba" })
    );
  });

  it("trims surrounding whitespace before saving", async () => {
    await saveSchedule({ ...baseSchedule, groupName: "  Riverside Chilimba  " });
    expect(lsSet).toHaveBeenCalledWith(
      "chilimba:group:hillcrest",
      expect.objectContaining({ groupName: "Riverside Chilimba" })
    );
  });

  it("rejects an empty (or whitespace-only) group name", async () => {
    await expect(saveSchedule({ ...baseSchedule, groupName: "   " })).rejects.toThrow(/enter a group name/i);
    expect(lsSet).not.toHaveBeenCalled();
  });

  it("rejects a group name over 60 characters", async () => {
    await expect(saveSchedule({ ...baseSchedule, groupName: "x".repeat(61) })).rejects.toThrow(/60 characters or fewer/i);
    expect(lsSet).not.toHaveBeenCalled();
  });

  it("accepts a group name at exactly the 60-character limit", async () => {
    await saveSchedule({ ...baseSchedule, groupName: "x".repeat(60) });
    expect(lsSet).toHaveBeenCalledWith(
      "chilimba:group:hillcrest",
      expect.objectContaining({ groupName: "x".repeat(60) })
    );
  });

  it("rejects a non-admin session before ever checking the name", async () => {
    currentSession.mockReturnValue(memberSession);
    await expect(saveSchedule({ ...baseSchedule, groupName: "" })).rejects.toThrow(/only a group admin/i);
    expect(lsSet).not.toHaveBeenCalled();
  });
});
