import React, { useEffect, useRef, useState } from "react";

/**
 * Wraps a horizontally-scrolling tab bar with a visible cue that more
 * tabs exist off-screen — a right-edge fade + chevron that appears only
 * when there's genuinely more content to scroll to, and disappears once
 * the user reaches the end. Without this, an overflowing tab bar (e.g.
 * an admin with 7 tabs on a phone) has no visual hint that swiping
 * reveals anything — it just looks like the row ends abruptly.
 */
export default function ScrollableTabs({ children }) {
  const scrollRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
    setCanScrollLeft(el.scrollLeft > 2);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    // Tab list content can change (e.g. admin tabs appearing after login) —
    // re-check shortly after mount too, once layout has settled.
    const t = setTimeout(updateScrollState, 100);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      clearTimeout(t);
    };
  }, [children]);

  const scrollByTabWidth = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 120, behavior: "smooth" });
  };

  return (
    <div className="tabs-scroll-wrap">
      {canScrollLeft && (
        <button
          className="tabs-edge-fade tabs-edge-fade-left"
          onClick={() => scrollByTabWidth(-1)}
          aria-label="Scroll tabs left"
        >
          <span className="tabs-chevron">‹</span>
        </button>
      )}
      <div className="tabs" ref={scrollRef} role="tablist" aria-label="Sections">
        {children}
      </div>
      {canScrollRight && (
        <button
          className="tabs-edge-fade tabs-edge-fade-right"
          onClick={() => scrollByTabWidth(1)}
          aria-label="Scroll tabs right"
        >
          <span className="tabs-chevron">›</span>
        </button>
      )}
    </div>
  );
}
