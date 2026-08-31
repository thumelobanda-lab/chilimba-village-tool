import { useEffect, useState } from "react";

const THEME_KEY = "openbook-theme";

/**
 * Light is the default (see styles.css's :root) — chosen for contrast
 * and readability, especially for older members reading small DUE/PAID/
 * BALANCE-style labels. Dark is opt-in, remembered per browser via
 * localStorage, same "just a key/value, no server round-trip" pattern as
 * every other per-device preference in this app (dismissed notices,
 * seen receipts, etc).
 */
function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc) — fall through to the default.
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Nothing to do if it can't persist — the in-memory state still applies for this session.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
