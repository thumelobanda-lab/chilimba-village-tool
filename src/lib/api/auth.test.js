import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks core.js so we can exercise auth.js's REAL-MODE branch (MOCK_MODE
// = false) even though the app itself ships with MOCK_MODE = true. This
// is the branch that was broken: login() returned the session from
// realFetch() but never persisted it, so every subsequent request had no
// Authorization header. See the fix in auth.js for the full explanation.
vi.mock("./core.js", () => ({
  MOCK_MODE: false,
  lsGet: vi.fn(),
  lsSet: vi.fn(),
  realFetch: vi.fn(),
}));

import { login, createGroup } from "./auth.js";
import { lsSet, realFetch } from "./core.js";

describe("login (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends groupSlug, name, and pin to the Worker in that shape", async () => {
    realFetch.mockResolvedValue({ name: "Harriet", role: "member", token: "abc123", isNew: true, groupSlug: "hillcrest", groupName: "Hillcrest Chilimba" });

    await login("hillcrest", "Harriet", "1234");

    expect(realFetch).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ groupSlug: "hillcrest", name: "Harriet", pin: "1234" }),
      })
    );
  });

  it("persists the session returned by the Worker so realFetch can find it on later calls", async () => {
    const serverSession = {
      name: "Harriet", role: "member", token: "abc123", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    };
    realFetch.mockResolvedValue(serverSession);

    const result = await login("hillcrest", "Harriet", "1234");

    expect(lsSet).toHaveBeenCalledWith("chilimba:session", {
      name: "Harriet", role: "member", token: "abc123", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });
    expect(result).toEqual(serverSession); // isNew still returned to the caller
  });

  it("does not persist isNew as part of the stored session", async () => {
    realFetch.mockResolvedValue({
      name: "Doreen", role: "admin", token: "xyz", isNew: false,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await login("hillcrest", "Doreen", "5678");

    const persisted = lsSet.mock.calls[0][1];
    expect(persisted).not.toHaveProperty("isNew");
  });
});

describe("createGroup (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends slug, groupName, adminName, and pin to the Worker", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "admin", token: "abc123", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await createGroup({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234" });

    expect(realFetch).toHaveBeenCalledWith(
      "/api/groups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234" }),
      })
    );
  });

  it("persists the session it gets back, same as login", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "admin", token: "xyz", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await createGroup({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234" });

    expect(lsSet).toHaveBeenCalledWith("chilimba:session", {
      name: "Harriet", role: "admin", token: "xyz", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });
  });

  it("validates required fields locally before ever calling the Worker", async () => {
    await expect(createGroup({ slug: "", groupName: "X", adminName: "Y", pin: "1234" })).rejects.toThrow(/group code/i);
    await expect(createGroup({ slug: "x", groupName: "", adminName: "Y", pin: "1234" })).rejects.toThrow(/group name/i);
    await expect(createGroup({ slug: "x", groupName: "X", adminName: "", pin: "1234" })).rejects.toThrow(/your name/i);
    await expect(createGroup({ slug: "x", groupName: "X", adminName: "Y", pin: "12" })).rejects.toThrow(/pin/i);
    expect(realFetch).not.toHaveBeenCalled();
  });
});
