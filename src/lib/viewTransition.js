import { flushSync } from "react-dom";

/**
 * True only when both the browser exposes document.startViewTransition
 * and the visitor hasn't asked for reduced motion — the two gates every
 * call site below shares, so nothing has to duplicate this check.
 */
export function canUseViewTransitions() {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return false;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs a state update inside document.startViewTransition for a native
 * crossfade between the before/after DOM, falling back to just calling
 * it directly — with identical resulting state either way — when the API
 * is unsupported or reduced motion is requested. flushSync forces React
 * to apply the update synchronously inside the transition callback;
 * without it, startViewTransition captures its "new" snapshot before
 * React has actually re-rendered, and the crossfade silently never plays.
 */
export function withViewTransition(updateFn) {
  if (!canUseViewTransitions()) {
    updateFn();
    return;
  }
  document.startViewTransition(() => flushSync(updateFn));
}
