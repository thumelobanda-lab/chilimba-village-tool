import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { groupScopedKey } from "../lib/api/core.js";
import { computeCutoutRect, computeTooltipPosition } from "../lib/spotlightPosition.js";
import OpenBookMark from "./OpenBookMark.jsx";

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
// by. `static: true` steps (the intro and the closing step) skip all of
// that and render a centered, branded card instead — there's no real
// element to introduce yet at the start, and nothing left to point at,
// at the end. Order groups steps by tab so the tour only switches tabs
// a few times, same as before.
function buildSteps(session) {
  const isAdmin = session?.role === "admin";

  const steps = [
    {
      static: true,
      title: "Welcome to OpenBook",
      body: "Your group's shared, honest record of contributions and payouts.",
    },
    {
      tab: "home",
      target: "cycle-progress-ring",
      title: "Your progress this round",
      body: "Fills as you contribute — tap it for your full history.",
    },
    {
      tab: "home",
      target: "log-payment-cta",
      title: "Log a payment",
      body: "Shows what's due next, or that you're all caught up.",
    },
    {
      tab: "ledger",
      target: "payment-info-panel",
      title: "Where to pay",
      body: "Mobile money or bank details your group leader has set up.",
    },
    {
      tab: null,
      target: "notification-bell",
      title: "Notifications",
      body: "Payment confirmations and updates land here — check any time.",
    },
    {
      tab: "home",
      target: "notice-board",
      title: "Notice board",
      body: "Anything your group leader posts for everyone shows up here.",
    },
    {
      tab: null,
      target: "calculator-button",
      title: "Quick calculator",
      body: "A plain calculator, always one tap away, separate from your totals.",
    },
  ];

  if (isAdmin) {
    steps.push({
      tab: "home",
      target: "manage-group",
      title: "Group Setup",
      body: "Edit the schedule, funds, and payment details — and manage members.",
    });
    steps.push({
      tab: "community",
      target: "community-notice-composer",
      title: "Post a notice",
      body: "Let every member know something — they'll see it on their dashboard.",
    });
  }

  steps.push({
    static: true,
    title: "That's it — you're set",
    body: "Reopen this any time from the Menu under \"How this app works.\"",
  });

  return steps;
}

const TOOLTIP_SIZE_ESTIMATE = { width: 280, height: 160 };
const MAX_FIND_ATTEMPTS = 15;

/**
 * A step-by-step tour that highlights real, already-rendered elements
 * (via data-tour anchors) with a dimmed backdrop and a cutout, rather
 * than showing its own illustration for every step — this is the app's
 * one and only walkthrough (an earlier self-contained modal version,
 * Walkthrough.jsx, was retired in favor of this). Intro and closing
 * steps are the exception: `static: true` in buildSteps() above renders
 * a centered card with the brand mark instead of trying to spotlight
 * something that doesn't exist yet (intro) or isn't there anymore
 * (closing). The same centered-card rendering doubles as the fallback
 * when a normal step's target can't be found at all (see `stuck` below)
 * — the tour never just breaks or freezes on a missing element.
 */
export default function SpotlightTour({ session, activeTab, onNavigate, onClose }) {
  const [steps] = useState(() => buildSteps(session));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  // True once a normal (non-static) step's target has failed to appear
  // after MAX_FIND_ATTEMPTS — falls back to the same centered-card
  // treatment as a static step rather than skipping or hanging.
  const [stuck, setStuck] = useState(false);
  const tooltipRef = useRef(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const centered = step.static || stuck;

  const finish = () => {
    markSpotlightTourSeen(session);
    onClose();
  };

  const skip = () => {
    markSpotlightTourSeen(session);
    onClose();
  };

  const advance = () => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Switch to the step's tab before trying to locate its target.
  useEffect(() => {
    if (!step.static && step.tab && step.tab !== activeTab) onNavigate(step.tab);
  }, [index, step.static, step.tab, activeTab, onNavigate]);

  // Find the target element, retrying across a few frames for anything
  // that mounts just after a tab switch. Falls back to a centered card
  // (via `stuck`) rather than skipping ahead or leaving the tour stalled
  // if it never appears — a member with no notices yet, for instance,
  // still gets the Notice Board step, just without a live element to
  // circle.
  useLayoutEffect(() => {
    if (step.static) {
      setRect(null);
      setStuck(false);
      return undefined;
    }
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
        setStuck(false);
      } else if (attempts < MAX_FIND_ATTEMPTS) {
        attempts += 1;
        frame = requestAnimationFrame(tryFind);
      } else {
        setRect(null);
        setStuck(true);
      }
    };

    setRect(null);
    setStuck(false);
    frame = requestAnimationFrame(tryFind);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, activeTab]);

  // Keep the cutout/tooltip aligned with the live element as the page
  // scrolls, resizes, or the device rotates underneath the tour.
  useEffect(() => {
    if (!rect || step.static) return undefined;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return undefined;

    const reposition = () => setRect(el.getBoundingClientRect());
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("orientationchange", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("orientationchange", reposition);
    };
  }, [rect, step.static, step.target]);

  // A normal step waiting on its target isn't ready to paint yet; a
  // static/stuck step has nothing to wait on.
  if (!centered && !rect) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const tooltipSize = tooltipRef.current
    ? { width: tooltipRef.current.offsetWidth, height: tooltipRef.current.offsetHeight }
    : TOOLTIP_SIZE_ESTIMATE;
  const cutout = centered ? null : computeCutoutRect(rect);
  const tooltipPos = centered
    ? {
        top: Math.max(8, (viewport.height - tooltipSize.height) / 2),
        left: Math.max(8, (viewport.width - tooltipSize.width) / 2),
      }
    : computeTooltipPosition(rect, viewport, tooltipSize);

  return (
    <div className="spotlight-overlay" onClick={skip}>
      {cutout && (
        <div
          className="spotlight-cutout"
          style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
        />
      )}
      <div
        ref={tooltipRef}
        className={"spotlight-tooltip" + (centered ? " spotlight-tooltip-centered" : "")}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {step.static && (
          <div className="spotlight-brand">
            <OpenBookMark size={44} />
          </div>
        )}
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
              <button className="btn-ghost-dark" onClick={back}>Back</button>
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
