import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LegalPage from "./components/LegalPage.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

// /terms and /privacy need to be reachable at a stable URL with no
// login (the Play Store's privacy-policy field links here directly) —
// there's no client-side router in this app, so this is the one place
// that branches on the raw pathname before the authenticated App tree
// ever mounts.
const LEGAL_PAGES = { "/terms": "terms", "/privacy": "privacy" };
const legalPage = LEGAL_PAGES[window.location.pathname];

// Explicit registration (nothing else in this app registers sw.js — see
// vite.config.js's injectRegister: false) paired with a one-time reload
// the moment a new worker takes control. sw.js's skipWaiting()/
// clientsClaim() mean a newly-deployed worker activates and takes over
// immediately rather than waiting for every tab to close, but an
// already-open tab is still running the OLD JS bundle in memory until
// it reloads — this listener is what actually delivers a deploy to
// someone who already has the app open, silently, without them needing
// to notice or close the tab themselves.
if ("serviceWorker" in navigator) {
  // A brand-new visitor with no worker controlling the page yet also
  // fires "controllerchange" the moment the very first install takes
  // over — there's nothing stale to replace there, so only reload for a
  // GENUINE update (a controller already existed before this one).
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" });
  });
}

// Group members, group admins, and the platform owner all land on the
// same App.jsx tree and the same single login screen (Login.jsx) now —
// see App.jsx for how it branches on an owner session vs. a group
// session post-login. There's no path-based split here anymore.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {legalPage ? <LegalPage page={legalPage} /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
