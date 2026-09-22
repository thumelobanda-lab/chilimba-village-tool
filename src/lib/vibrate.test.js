import { describe, it, expect, afterEach, vi } from "vitest";
import { vibrateOnce } from "./vibrate.js";

const originalNavigator = globalThis.navigator;

afterEach(() => {
  globalThis.navigator = originalNavigator;
});

describe("vibrateOnce", () => {
  it("does nothing and never throws when navigator.vibrate doesn't exist (iOS Safari)", () => {
    globalThis.navigator = {};
    expect(() => vibrateOnce()).not.toThrow();
  });

  it("does nothing and never throws when navigator itself is unavailable", () => {
    globalThis.navigator = undefined;
    expect(() => vibrateOnce()).not.toThrow();
  });

  it("calls navigator.vibrate once with a single short duration, not a pattern", () => {
    const vibrate = vi.fn();
    globalThis.navigator = { vibrate };
    vibrateOnce();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(50);
  });

  it("swallows an error if the browser exposes vibrate but rejects the call", () => {
    globalThis.navigator = {
      vibrate: () => {
        throw new Error("denied");
      },
    };
    expect(() => vibrateOnce()).not.toThrow();
  });
});
