import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { groupScopedKey } from "../lib/api/core.js";
import { computeCutoutRect, computeTooltipPosition } from "../lib/spotlightPosition.js";

// Same per-account tracking shape as Walkthrough.jsx's *_SEEN_KEY, kept
// as a separate key since a member can dismiss one tour without it
// marking the other seen.
export function spotlightTourSeenKey(session) {
  return groupScopedKey(session, "spotlight-tour-seen", session.name.toLowerCase());
}

export function hasSeenSpotlightTour(session) {
  if (!session) return false;
  return localStorage.getItem(spotlightTourSeenKey(session)) === "1";
}

function markSpotlightTourSeen(session) {
  if (!session) return;
  localStorage.setItem(spotlightTourSeenKey(session), "1");
}

// Each step names the tab its target lives on (null if it's reachable
// from the header regardless of tab) and the data-tour value to find it
// by. Order groups steps by tab so the tour only switches tabs twice.
function buildSteps(session) {
  const isAdmin = session?.role === "admin";

  const steps = [
    {
      tab: "ledger",
      target: "payment-info-panel",
      title: "Where to pay",
      body: "This shows the mobile money or bank details your group leader has set up — that's where your contribution actually goes.",
    },
    {
      tab: "ledger",
      target: "ledger-pay-due",
      title: "Your next payment",
      body: "This always shows what's due next, or that you're all paid up. Tap it any time to log a payment.",
    },
    {
      tab: null,
      target: "calculator-button",
      title: "Quick calculator",
      body: "Need to work out a number? This calculator is here any time, separate from your payment totals.",
    },
  ];

  if (isAdmin) {
    steps.push({
      tab: "community",
      target: "community-notice-composer",
      title: "Post a notice",
      body: "As a group leader, post something here and every member sees it on their dashboard.",
    });
  }

  return steps;
}

const TOOLTIP_SIZE_ESTIMATE = { width: 280, height: 160 };
const MAX_FIND_ATTEMPTS = 15;

/**
 * A step-by-step tour that highlights real, already-rendered elements
 * (via data-tour anchors) rather than showing its own illustration —
 * see Walkthrough.jsx for the older, self-contained modal version of a
 * tour. Some targets are conditional (community-notice-composer only
 * renders for admins), so a step whose target never shows up is skipped
 * automatically rather than stalling the tour.
 */
export default function SpotlightTour({ session, activeTab, onNavigate, onClose }) {
  const [steps] = useState(() => buildSteps(session));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const tooltipRef = useRef(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = () => {
    markSpotlightTourSeen(session);
    onClose();
  };

  const skip = () => {
    markSpotlightTourSeen(session);
    onClose();
  };

  const advance = () => {
    setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
    if (isLast) finish();
  };

  // Switch to the step's tab before trying to locate its target.
  useEffect(() => {
    if (step.tab && step.tab !== activeTab) onNavigate(step.tab);
  }, [index, step.tab, activeTab, onNavigate]);

  // Find the target element, retrying across a few frames for anything
  // that mounts just after a tab switch. Give up and skip to the next
  // step if it never appears.
  useLayoutEffect(() => {
    if (step.tab && step.tab !== activeTab) return undefined;

    let cancelled = false;
    let attempts = 0;
    let frame;

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setRect(el.getBoundingClientRect());
      } else if (attempts < MAX_FIND_ATTEMPTS) {
        attempts += 1;
        frame = requestAnimationFrame(tryFind);
      } else if (isLast) {
        finish();
      } else {
        advance();
      }
    };

    setRect(null);
    frame = requestAnimationFrame(tryFind);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, activeTab]);

  // Keep the cutout/tooltip aligned with the live element as the page
  // scrolls or resizes underneath the tour.
  useEffect(() => {
    if (!rect) return undefined;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return undefined;

    const reposition = () => setRect(el.getBoundingClientRect());
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [rect, step.target]);

  if (!rect) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const tooltipSize = tooltipRef.current
    ? { width: tooltipRef.current.offsetWidth, height: tooltipRef.current.offsetHeight }
    : TOOLTIP_SIZE_ESTIMATE;
  const cutout = computeCutoutRect(rect);
  const tooltipPos = computeTooltipPosition(rect, viewport, tooltipSize);

  return (
    <div className="spotlight-overlay" onClick={skip}>
      <div
        className="spotlight-cutout"
        style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
      />
      <div
        ref={tooltipRef}
        className="spotlight-tooltip"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="spotlight-dots">
          {steps.map((_, i) => (
            <span key={i} className={"spotlight-dot" + (i === index ? " spotlight-dot-active" : "")} />
          ))}
        </div>
        <h4 className="spotlight-title">{step.title}</h4>
        <p className="spotlight-body">{step.body}</p>
        <div className="spotlight-controls">
          <button className="btn-link" onClick={skip}>Skip</button>
          <div className="spotlight-nav">
            {index > 0 && (
              <button className="btn-ghost-dark" onClick={() => setIndex((i) => i - 1)}>Back</button>
            )}
            <button className="btn-primary" style={{ width: "auto" }} onClick={advance}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
