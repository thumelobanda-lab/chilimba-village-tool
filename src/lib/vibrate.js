/**
 * A single short buzz (50ms, not a pattern) for a payment being logged
 * or confirmed — a small physical confirmation alongside whatever visual
 * one already shows. Guarded for browsers with no Vibration API at all
 * (iOS Safari) and for ones that expose the method but throw calling it
 * (no user-gesture, permission policy, etc.) — either way this must
 * never be the thing that breaks a payment flow.
 */
export function vibrateOnce() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(50);
  } catch {
    // Never let a haptic nice-to-have surface as an error.
  }
}
