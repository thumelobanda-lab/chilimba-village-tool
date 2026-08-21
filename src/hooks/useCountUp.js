import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animates a displayed number toward `value` over `duration`ms — used
 * for the dashboard's headline figures (outstanding balance, community
 * fund total, group pulse contributed-this-cycle). Purely cosmetic: the
 * number is never rounded or altered, only its on-screen reveal is
 * eased, and a member who has requested reduced motion sees the final
 * value immediately instead.
 *
 * Animates FROM wherever it's currently displayed, not always from
 * zero — the first render's "from" is 0 (a reveal), but a later change
 * (a payment posts, the balance drops) counts from the old figure to
 * the new one, the same way a real running total would, rather than
 * visibly resetting to 0 and re-climbing every time the value updates.
 *
 * @param {number} value - the target figure
 * @param {number} [duration] - animation length in ms
 * @returns {number} the currently-displayed value
 */
export function useCountUp(value, duration = 800) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(prefersReducedMotion() ? target : 0);
  const frameRef = useRef();
  // Mirrors `display`, but read synchronously inside the effect below —
  // state itself would be a stale closure there. Doubles as the "from"
  // for the next animation, updated every tick so an animation that gets
  // interrupted by another value change resumes from where it actually
  // is on screen, not from a stale target.
  const displayRef = useRef(display);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      displayRef.current = target;
      return;
    }
    const from = displayRef.current;
    if (from === target) return;

    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — quick start, gentle settle
      const next = from + (target - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}
