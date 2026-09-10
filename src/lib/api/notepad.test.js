import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./core.js", () => ({
  MOCK_MODE: false,
  lsGet: vi.fn(),
  lsSet: vi.fn(),
  realFetch: vi.fn(),
  currentSession: vi.fn(),
  groupScopedKey: vi.fn(),
}));

import { getNotepad, saveNotepad } from "./notepad.js";
import { realFetch, currentSession } from "./core.js";

const baseSession = { name: "Harriet", role: "member", token: "abc123", groupSlug: "hillcrest" };

describe("getNotepad (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession.mockReturnValue(baseSession);
  });

  it("rejects when nobody is signed in", async () => {
    currentSession.mockReturnValue(null);
    await expect(getNotepad()).rejects.toThrow(/not signed in/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("fetches GET /api/notepad", async () => {
    realFetch.mockResolvedValue({ text: "call harriet re: cycle 2" });
    const result = await getNotepad();
    expect(realFetch).toHaveBeenCalledWith("/api/notepad");
    expect(result.text).toBe("call harriet re: cycle 2");
  });
});

describe("saveNotepad (real-mode branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession.mockReturnValue(baseSession);
  });

  it("rejects when nobody is signed in", async () => {
    currentSession.mockReturnValue(null);
    await expect(saveNotepad("hi")).rejects.toThrow(/not signed in/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("rejects text over the length limit before ever hitting the Worker", async () => {
    await expect(saveNotepad("x".repeat(5001))).rejects.toThrow(/under 5,000 characters/i);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it("PUTs the text to /api/notepad", async () => {
    realFetch.mockResolvedValue({ ok: true });
    await saveNotepad("a reminder");
    expect(realFetch).toHaveBeenCalledWith("/api/notepad", {
      method: "PUT",
      body: JSON.stringify({ text: "a reminder" }),
    });
  });
});
