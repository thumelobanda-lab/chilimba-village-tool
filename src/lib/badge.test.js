import { describe, it, expect, afterEach, vi } from "vitest";
import { setAppBadge, clearAppBadge } from "./badge.js";

const originalNavigator = globalThis.navigator;

afterEach(() => {
  globalThis.navigator = originalNavigator;
});

describe("setAppBadge", () => {
  it("does nothing and never throws when the Badging API doesn't exist", () => {
    globalThis.navigator = {};
    expect(() => setAppBadge(3)).not.toThrow();
  });

  it("does nothing and never throws when navigator itself is unavailable", () => {
    globalThis.navigator = undefined;
    expect(() => setAppBadge(3)).not.toThrow();
  });

  it("sets a positive count", () => {
    const setAppBadgeFn = vi.fn();
    globalThis.navigator = { setAppBadge: setAppBadgeFn };
    setAppBadge(3);
    expect(setAppBadgeFn).toHaveBeenCalledWith(3);
  });

  it("clears instead of setting 0, when clearAppBadge exists", () => {
    const setAppBadgeFn = vi.fn();
    const clearAppBadgeFn = vi.fn();
    globalThis.navigator = { setAppBadge: setAppBadgeFn, clearAppBadge: clearAppBadgeFn };
    setAppBadge(0);
    expect(setAppBadgeFn).not.toHaveBeenCalled();
    expect(clearAppBadgeFn).toHaveBeenCalledTimes(1);
  });

  it("swallows an error if the browser exposes setAppBadge but rejects the call", () => {
    globalThis.navigator = {
      setAppBadge: () => {
        throw new Error("denied");
      },
    };
    expect(() => setAppBadge(3)).not.toThrow();
  });
});

describe("clearAppBadge", () => {
  it("does nothing and never throws when the Badging API doesn't exist", () => {
    globalThis.navigator = {};
    expect(() => clearAppBadge()).not.toThrow();
  });

  it("calls navigator.clearAppBadge when it exists", () => {
    const clearAppBadgeFn = vi.fn();
    globalThis.navigator = { clearAppBadge: clearAppBadgeFn };
    clearAppBadge();
    expect(clearAppBadgeFn).toHaveBeenCalledTimes(1);
  });

  it("swallows an error if the browser exposes clearAppBadge but rejects the call", () => {
    globalThis.navigator = {
      clearAppBadge: () => {
        throw new Error("denied");
      },
    };
    expect(() => clearAppBadge()).not.toThrow();
  });
});
