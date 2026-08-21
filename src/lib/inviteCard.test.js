import { describe, it, expect } from "vitest";
import {
  buildInviteMessage,
  buildWhatsAppShareUrl,
  buildInviteCardFilename,
  buildCardContent,
  buildJoinUrl,
} from "./inviteCard.js";

const groupInfo = { groupName: "Hillcrest Chilimba", groupSlug: "hillcrest", appUrl: "https://chilimba-circle.pages.dev" };

describe("buildJoinUrl", () => {
  it("appends ?join=<slug> to the app URL", () => {
    expect(buildJoinUrl("https://chilimba-circle.pages.dev", "hillcrest")).toBe(
      "https://chilimba-circle.pages.dev/?join=hillcrest"
    );
  });

  it("URL-encodes a slug with special characters", () => {
    expect(buildJoinUrl("https://x.com", "a b/c")).toBe("https://x.com/?join=a%20b%2Fc");
  });

  it("falls back to the bare app URL when the slug is missing", () => {
    expect(buildJoinUrl("https://x.com", "")).toBe("https://x.com");
    expect(buildJoinUrl("https://x.com", null)).toBe("https://x.com");
  });

  it("returns an empty string when appUrl is missing too", () => {
    expect(buildJoinUrl("", "hillcrest")).toBe("");
  });
});

describe("buildInviteMessage", () => {
  it("includes the group name, code, and a join link carrying the code", () => {
    const msg = buildInviteMessage(groupInfo);
    expect(msg).toContain("Hillcrest Chilimba");
    expect(msg).toContain("Group code: hillcrest");
    expect(msg).toContain("https://chilimba-circle.pages.dev/?join=hillcrest");
  });

  it("throws if any required field is missing", () => {
    expect(() => buildInviteMessage({ groupSlug: "hillcrest", appUrl: "https://x.com" })).toThrow();
    expect(() => buildInviteMessage({ groupName: "X", appUrl: "https://x.com" })).toThrow();
    expect(() => buildInviteMessage({ groupName: "X", groupSlug: "x" })).toThrow();
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("produces a wa.me link with the message URL-encoded", () => {
    const url = buildWhatsAppShareUrl("Hello, world! Code: hillcrest");
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(url).toContain(encodeURIComponent("Hello, world! Code: hillcrest"));
  });

  it("safely encodes special characters (newlines, emoji, symbols)", () => {
    const message = "Line one\nLine two 🤝 & more";
    const url = buildWhatsAppShareUrl(message);
    // decoding the URL should round-trip back to the original message
    const decoded = decodeURIComponent(url.replace("https://wa.me/?text=", ""));
    expect(decoded).toBe(message);
  });
});

describe("buildInviteCardFilename", () => {
  it("builds a filename from the group slug", () => {
    expect(buildInviteCardFilename("hillcrest")).toBe("chilimba-invite-hillcrest.png");
  });

  it("strips characters that aren't safe in a filename", () => {
    expect(buildInviteCardFilename("hill crest!/../")).toBe("chilimba-invite-hill-crest-----.png");
  });

  it("falls back to a generic name when slug is missing", () => {
    expect(buildInviteCardFilename("")).toBe("chilimba-invite-group.png");
    expect(buildInviteCardFilename(null)).toBe("chilimba-invite-group.png");
  });
});

describe("buildCardContent", () => {
  it("includes every field needed to draw the card", () => {
    const content = buildCardContent({ ...groupInfo, cycleName: "Cycle 3" });
    expect(content.groupName).toBe("Hillcrest Chilimba");
    expect(content.code).toBe("hillcrest");
    expect(content.cycleLabel).toBe("Cycle 3");
    expect(content.url).toBe("https://chilimba-circle.pages.dev/?join=hillcrest");
    expect(content.tagline).toBeTruthy();
    expect(content.brand).toBeTruthy();
  });

  it("omits the cycle label when no cycle name is given", () => {
    const content = buildCardContent({ groupName: "X", groupSlug: "x", appUrl: "https://x.com" });
    expect(content.cycleLabel).toBeNull();
  });

  it("provides sensible fallbacks for missing fields rather than throwing", () => {
    expect(() => buildCardContent({})).not.toThrow();
    const content = buildCardContent({});
    expect(content.groupName).toBeTruthy();
    expect(content.code).toBe("");
  });
});
