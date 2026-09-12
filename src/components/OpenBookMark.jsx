import React from "react";

/**
 * The login screen's brand mark — an open book with a ledger line down
 * each page and a gold ribbon bookmark, echoing "OpenBook" literally
 * rather than relying on the wordmark alone. Colors are hardcoded (same
 * choice LoginScene.jsx makes, see its own doc comment) — this is a
 * fixed brand illustration, not chrome, so it must look identical in
 * light and dark mode rather than inverting with the theme.
 *
 * Deliberately small and static (no animation) — LoginScene.jsx already
 * owns the login screen's one big moment; this just sits above it as a
 * quiet, permanent identity mark, the way an app icon would.
 */
export default function OpenBookMark({ size = 56 }) {
  return (
    <svg
      className="open-book-mark"
      width={size}
      height={size * (44 / 64)}
      viewBox="0 0 64 44"
      fill="none"
      role="img"
      aria-label="OpenBook"
    >
      {/* left page */}
      <path
        d="M32 10C26 6 16 4 6 5.5C4.9 5.66 4 6.6 4 7.7V34.3C4 35.6 5.2 36.5 6.4 36.2C15.6 34 25 36 32 40V10Z"
        fill="#F3EEDD"
        stroke="#1F4B3F"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* right page */}
      <path
        d="M32 10C38 6 48 4 58 5.5C59.1 5.66 60 6.6 60 7.7V34.3C60 35.6 58.8 36.5 57.6 36.2C48.4 34 39 36 32 40V10Z"
        fill="#F3EEDD"
        stroke="#1F4B3F"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* spine shadow */}
      <path d="M32 10V40" stroke="#1F4B3F" strokeWidth="1.6" strokeLinecap="round" />
      {/* ledger lines, left page */}
      <path d="M9 13.5C16 12.5 23 13.5 28.5 16" stroke="#8FA876" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 19.5C16 18.5 23 19.5 28.5 22" stroke="#8FA876" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 25.5C16 24.5 23 25.5 28.5 28" stroke="#8FA876" strokeWidth="1.4" strokeLinecap="round" />
      {/* ledger lines, right page */}
      <path d="M55 13.5C48 12.5 41 13.5 35.5 16" stroke="#8FA876" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M55 19.5C48 18.5 41 19.5 35.5 22" stroke="#8FA876" strokeWidth="1.4" strokeLinecap="round" />
      {/* gold ribbon bookmark */}
      <path d="M32 2V13L35 10.2L38 13V2Z" fill="#D4A94A" />
    </svg>
  );
}
