import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animates a displayed number counting up to `value` over `duration`ms —
 * used for the dashboard's headline figures (outstanding balance,
 * community fund total). Purely cosmetic: the number is never rounded or
 * altered, only its on-screen reveal is eased, and a member who has
 * requested reduced motion sees the final value immediately instead.
 *
 * @param {number} value - the target figure
 * @param {number} [duration] - animation length in ms
 * @returns {number} the currently-displayed value
 */
export function useCountUp(value, duration = 800) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(prefersReducedMotion() ? target : 0);
  const frameRef = useRef();

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — quick start, gentle settle
      setDisplay(target * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}
