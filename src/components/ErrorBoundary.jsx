import React from "react";

/**
 * Without this, ANY uncaught error in ANY component blanks the entire
 * app to a white screen with zero information — no error message, no
 * way to screenshot what actually went wrong, nothing to debug from.
 * This catches it, shows the real error text, and offers a reload —
 * turning an invisible crash into something that can actually be fixed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Chilimba app crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "40px auto" }}>
          <h2 style={{ color: "#B3232F" }}>Something went wrong</h2>
          <p style={{ color: "#5C7188" }}>
            This screen crashed instead of loading. A screenshot of the error below, sent to
            support, will help fix it.
          </p>
          <pre style={{
            background: "#F6F8FA",
            border: "1px solid #DDE3E8",
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              background: "#1F4B3F",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
