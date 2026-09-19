/**
 * Geometry for SpotlightTour.jsx's cutout + tooltip — pure so it's
 * testable without a real DOM/jsdom (this project's test setup doesn't
 * include jsdom, see Walkthrough.test.js's own comment on that).
 */

// A little breathing room around the target so the cutout doesn't hug
// the element's exact edges.
const CUTOUT_PADDING = 6;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 8;

export function computeCutoutRect(targetRect, padding = CUTOUT_PADDING) {
  return {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };
}

/**
 * @param {{top:number,left:number,right:number,bottom:number,width:number,height:number}} targetRect
 * @param {{width:number,height:number}} viewport
 * @param {{width:number,height:number}} tooltipSize
 */
export function computeTooltipPosition(targetRect, viewport, tooltipSize) {
  const fitsBelow = targetRect.bottom + TOOLTIP_GAP + tooltipSize.height <= viewport.height - VIEWPORT_MARGIN;
  const top = fitsBelow
    ? targetRect.bottom + TOOLTIP_GAP
    : Math.max(VIEWPORT_MARGIN, targetRect.top - TOOLTIP_GAP - tooltipSize.height);

  const centered = targetRect.left + targetRect.width / 2 - tooltipSize.width / 2;
  const left = Math.min(
    Math.max(centered, VIEWPORT_MARGIN),
    Math.max(VIEWPORT_MARGIN, viewport.width - tooltipSize.width - VIEWPORT_MARGIN)
  );

  return { top, left };
}
