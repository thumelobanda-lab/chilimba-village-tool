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

import { login, join, createGroup } from "./auth.js";
import { lsSet, realFetch } from "./core.js";

describe("login (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends groupSlug, identifier, and pin to the Worker in that shape", async () => {
    realFetch.mockResolvedValue({ name: "Harriet", role: "member", token: "abc123", isNew: false, groupSlug: "hillcrest", groupName: "Hillcrest Chilimba" });

    await login("hillcrest", "Harriet", "1234");

    expect(realFetch).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ groupSlug: "hillcrest", identifier: "Harriet", pin: "1234" }),
      })
    );
  });

  it("works the same way with a phone number as the identifier", async () => {
    realFetch.mockResolvedValue({ name: "Harriet", role: "member", token: "abc123", isNew: false, groupSlug: "hillcrest", groupName: "Hillcrest Chilimba" });

    await login("hillcrest", "0971234567", "1234");

    expect(realFetch).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        body: JSON.stringify({ groupSlug: "hillcrest", identifier: "0971234567", pin: "1234" }),
      })
    );
  });

  it("persists the session returned by the Worker so realFetch can find it on later calls", async () => {
    const serverSession = {
      name: "Harriet", role: "member", token: "abc123", isNew: false,
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

  it("propagates a not-found account as a clear error rather than silently registering", async () => {
    realFetch.mockRejectedValue(new Error("API error 404"));

    await expect(login("hillcrest", "nobody", "1234")).rejects.toThrow("API error 404");
    expect(lsSet).not.toHaveBeenCalled();
  });
});

describe("join (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends groupSlug, name, phone, and pin to the Worker", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "member", token: "abc123", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await join("hillcrest", "Harriet", "0971234567", "1234", true);

    expect(realFetch).toHaveBeenCalledWith(
      "/api/join",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ groupSlug: "hillcrest", name: "Harriet", phone: "0971234567", pin: "1234", termsAccepted: true }),
      })
    );
  });

  it("persists the session it gets back, same as login", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "member", token: "xyz", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await join("hillcrest", "Harriet", "0971234567", "1234", true);

    expect(lsSet).toHaveBeenCalledWith("chilimba:session", {
      name: "Harriet", role: "member", token: "xyz", groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });
  });

  it("validates required fields locally before ever calling the Worker", async () => {
    await expect(join("hillcrest", "", "0971234567", "1234", true)).rejects.toThrow(/name/i);
    await expect(join("hillcrest", "Harriet", "", "1234", true)).rejects.toThrow(/phone/i);
    await expect(join("hillcrest", "Harriet", "123", "1234", true)).rejects.toThrow(/phone/i); // too short
    await expect(join("hillcrest", "Harriet", "0971234567", "12", true)).rejects.toThrow(/pin/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("requires Terms & Conditions acceptance before ever calling the Worker", async () => {
    await expect(join("hillcrest", "Harriet", "0971234567", "1234", false)).rejects.toThrow(/terms/i);
    await expect(join("hillcrest", "Harriet", "0971234567", "1234")).rejects.toThrow(/terms/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("accepts a phone number with a leading + and formatting characters", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "member", token: "abc", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await join("hillcrest", "Harriet", "+260 97-123-4567", "1234", true);
    expect(realFetch).toHaveBeenCalled();
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

    await createGroup({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234", termsAccepted: true });

    expect(realFetch).toHaveBeenCalledWith(
      "/api/groups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234", termsAccepted: true }),
      })
    );
  });

  it("persists the session it gets back, same as login", async () => {
    realFetch.mockResolvedValue({
      name: "Harriet", role: "admin", token: "xyz", isNew: true,
      groupSlug: "hillcrest", groupName: "Hillcrest Chilimba",
    });

    await createGroup({ slug: "hillcrest", groupName: "Hillcrest Chilimba", adminName: "Harriet", pin: "1234", termsAccepted: true });

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

  it("requires Terms & Conditions acceptance before ever calling the Worker", async () => {
    await expect(createGroup({ slug: "x", groupName: "X", adminName: "Y", pin: "1234", termsAccepted: false }))
      .rejects.toThrow(/terms/i);
    await expect(createGroup({ slug: "x", groupName: "X", adminName: "Y", pin: "1234" })).rejects.toThrow(/terms/i);
    expect(realFetch).not.toHaveBeenCalled();
  });
});
