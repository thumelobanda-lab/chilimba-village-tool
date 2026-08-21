import { describe, it, expect, vi, beforeEach } from "vitest";

// Same approach as auth.test.js: mock core.js so we can exercise
// profile.js's REAL-MODE branch (MOCK_MODE = false) without a browser's
// localStorage or the app's actual MOCK_MODE flag.
vi.mock("./core.js", () => ({
  MOCK_MODE: false,
  lsGet: vi.fn(),
  lsSet: vi.fn(),
  realFetch: vi.fn(),
  currentSession: vi.fn(),
  groupScopedKey: vi.fn(),
}));

import { updateProfile, getMe } from "./profile.js";
import { lsSet, realFetch, currentSession } from "./core.js";

const baseSession = {
  name: "Harriet", role: "member", token: "abc123",
  groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
};

describe("updateProfile (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession.mockReturnValue(baseSession);
  });

  it("rejects when nobody is signed in", async () => {
    currentSession.mockReturnValue(null);
    await expect(updateProfile({ displayName: "Harry" })).rejects.toThrow(/not signed in/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("rejects a no-op call before ever hitting the Worker", async () => {
    await expect(updateProfile({})).rejects.toThrow(/nothing to update/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("sends displayName, currentPin, and newPin to PUT /api/me", async () => {
    realFetch.mockResolvedValue({ name: "Harry" });

    await updateProfile({ displayName: "Harry", currentPin: "1234", newPin: "5678" });

    expect(realFetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ displayName: "Harry", currentPin: "1234", newPin: "5678" }),
      })
    );
  });

  it("merges the returned name into the persisted session, keeping the token", async () => {
    realFetch.mockResolvedValue({ name: "Harry" });

    await updateProfile({ displayName: "Harry" });

    expect(lsSet).toHaveBeenCalledWith("chilimba:session", { ...baseSession, name: "Harry" });
  });

  it("propagates a Worker rejection (e.g. wrong current PIN) instead of persisting anything", async () => {
    realFetch.mockRejectedValue(new Error("API error 401"));

    await expect(updateProfile({ currentPin: "0000", newPin: "1111" })).rejects.toThrow("API error 401");
    expect(lsSet).not.toHaveBeenCalled();
  });
});

describe("getMe (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession.mockReturnValue(baseSession);
  });

  it("rejects when nobody is signed in", async () => {
    currentSession.mockReturnValue(null);
    await expect(getMe()).rejects.toThrow(/not signed in/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("GETs /api/me with no body", async () => {
    realFetch.mockResolvedValue({ name: "Harriet", role: "admin", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba" });

    await getMe();

    expect(realFetch).toHaveBeenCalledWith("/api/me");
  });

  it("persists the refreshed role/name/group into the session, keeping the token", async () => {
    realFetch.mockResolvedValue({ name: "Harriet", role: "admin", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba" });

    const result = await getMe();

    expect(lsSet).toHaveBeenCalledWith("chilimba:session", { ...baseSession, role: "admin" });
    expect(result.role).toBe("admin");
  });

  it("propagates a Worker rejection (e.g. session no longer valid) instead of persisting anything", async () => {
    realFetch.mockRejectedValue(new Error("API error 401"));

    await expect(getMe()).rejects.toThrow("API error 401");
    expect(lsSet).not.toHaveBeenCalled();
  });
});
