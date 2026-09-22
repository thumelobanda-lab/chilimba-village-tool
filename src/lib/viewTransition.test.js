import { describe, it, expect, afterEach, vi } from "vitest";
import { canUseViewTransitions, withViewTransition } from "./viewTransition.js";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});

describe("canUseViewTransitions", () => {
  it("is false when document.startViewTransition doesn't exist (Safari/Firefox today)", () => {
    globalThis.document = {};
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    expect(canUseViewTransitions()).toBe(false);
  });

  it("is false when prefers-reduced-motion is set, even if the API exists", () => {
    globalThis.document = { startViewTransition: vi.fn() };
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    expect(canUseViewTransitions()).toBe(false);
  });

  it("is true when the API exists and reduced motion isn't requested", () => {
    globalThis.document = { startViewTransition: vi.fn() };
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    expect(canUseViewTransitions()).toBe(true);
  });
});

describe("withViewTransition", () => {
  it("falls back to calling the update directly when unsupported", () => {
    globalThis.document = {};
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    const updateFn = vi.fn();
    expect(() => withViewTransition(updateFn)).not.toThrow();
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to calling the update directly under reduced motion, without touching startViewTransition", () => {
    const startViewTransition = vi.fn();
    globalThis.document = { startViewTransition };
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    const updateFn = vi.fn();
    withViewTransition(updateFn);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("routes the update through document.startViewTransition when supported", () => {
    const startViewTransition = vi.fn((cb) => cb());
    globalThis.document = { startViewTransition };
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    const updateFn = vi.fn();
    withViewTransition(updateFn);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledTimes(1);
  });
});
