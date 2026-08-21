import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import OwnerApp from "./OwnerApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

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
