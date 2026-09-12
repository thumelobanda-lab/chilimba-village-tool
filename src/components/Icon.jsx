import React from "react";

/**
 * The app's one shared set of UI glyphs — plain stroked line icons
 * (currentColor, so they inherit whatever text color surrounds them),
 * replacing the pictographic emoji this app used to sprinkle through
 * buttons/labels/headings. Kept deliberately small and hand-drawn rather
 * than pulling in an icon library: this app only ever needs a couple
 * dozen concepts, and every caller already just wants a 1em-ish glyph
 * next to some text, not a themeable icon system.
 *
 * `size` is the square viewport in px; stroke scales with it so an icon
 * dropped into a small vs. large context still reads cleanly.
 */
const PATHS = {
  calculator: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10.01" />
      <line x1="12" y1="10" x2="12" y2="10.01" />
      <line x1="16" y1="10" x2="16" y2="10.01" />
      <line x1="8" y1="14" x2="8" y2="14.01" />
      <line x1="12" y1="14" x2="12" y2="14.01" />
      <line x1="16" y1="14" x2="16" y2="14.01" />
      <line x1="8" y1="18" x2="8" y2="18.01" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
      <line x1="16" y1="18" x2="16" y2="18.01" />
    </>
  ),
  notebook: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="12" y1="8" x2="18" y2="8" />
      <line x1="12" y1="12" x2="18" y2="12" />
      <line x1="12" y1="16" x2="16" y2="16" />
    </>
  ),
  book: (
    <>
      <path d="M4 5c2-1.3 5-1.3 8 0v14c-3-1.3-6-1.3-8 0V5Z" />
      <path d="M20 5c-2-1.3-5-1.3-8 0v14c3-1.3 6-1.3 8 0V5Z" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V10" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <line x1="2.5" y1="10" x2="21.5" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.3 14.2c2.6.3 4.7 2.7 4.7 5.8" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 10.8 15 16 9.5" />
    </>
  ),
  flame: <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1.5-1-2-1-3.3 1.6 1 3 3.3 3 6a6 6 0 0 1-12 0c0-4.5 4-6 7-10.7Z" />,
  money: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="10" x2="6" y2="10.01" />
      <line x1="18" y1="14" x2="18" y2="14.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10 12 4l9 6" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="6" y1="10" x2="6" y2="17" />
      <line x1="10.7" y1="10" x2="10.7" y2="17" />
      <line x1="13.3" y1="10" x2="13.3" y2="17" />
      <line x1="18" y1="10" x2="18" y2="17" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l9 4V5L6 9H5a2 2 0 0 0-2 2Z" />
      <path d="M15 8.5a4 4 0 0 1 0 7" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5 12 13l9-6.5" />
    </>
  ),
  flag: (
    <>
      <line x1="5" y1="3" x2="5" y2="21" />
      <path d="M5 4h13l-3 4 3 4H5Z" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="20" y1="20" x2="15.3" y2="15.3" />
    </>
  ),
  chart: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="7" y1="20" x2="7" y2="12" />
      <line x1="12" y1="20" x2="12" y2="7" />
      <line x1="17" y1="20" x2="17" y2="10" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3Z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4" />
      <path d="M7 8 12 3l5 5" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>
  ),
  message: <path d="M4 4h16v12H9l-4 4V4Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
      <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
      <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  sparkle: (
    <>
      <path d="M12 3v5" />
      <path d="M12 16v5" />
      <path d="M3 12h5" />
      <path d="M16 12h5" />
      <path d="M6 6l3 3" />
      <path d="M15 15l3 3" />
      <path d="M18 6l-3 3" />
      <path d="M9 15l-3 3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" />
      <path d="M4 4v4.6h4.6" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4" />
      <path d="M20 20v-4.6h-4.6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    </>
  ),
  tools: (
    <>
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L14.7 6.3Z" />
    </>
  ),
  tag: (
    <>
      <path d="M12.6 3H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l9.4 9.4a2 2 0 0 0 2.8 0l6.6-6.6a2 2 0 0 0 0-2.8L13 3.6a2 2 0 0 0-1.4-.6Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </>
  ),
};

export default function Icon({ name, size = 16, className, title }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {path}
    </svg>
  );
}
