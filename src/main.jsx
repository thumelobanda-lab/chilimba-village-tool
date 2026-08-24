import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import OwnerApp from "./OwnerApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

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

// /owner renders a completely separate component tree (OwnerApp.jsx) —
// there's no shared state or component between it and the group-member
// App below, and no router pulling them into the same tree at runtime.
// A plain pathname check is all this needs; adding a routing library for
// one static split would be more machinery than the split itself.
const isOwnerPath = typeof window !== "undefined" && window.location.pathname.startsWith("/owner");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isOwnerPath ? <OwnerApp /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
