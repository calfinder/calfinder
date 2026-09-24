"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[CalFinder] Uncaught error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8f5ef",
            fontFamily: "system-ui, sans-serif",
            color: "#1a1612",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#6b6356", marginBottom: "1.5rem", maxWidth: 480 }}>
            CalFinder hit an unexpected error. Try refreshing the page. Your saved courses are
            stored locally and won&apos;t be lost.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              background: "#002855",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.6rem 1.4rem",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {process.env.NODE_ENV === "development" && (
            <pre
              style={{
                marginTop: "1.5rem",
                background: "#fff3f3",
                border: "1px solid #fca5a5",
                borderRadius: 6,
                padding: "1rem",
                fontSize: "0.75rem",
                textAlign: "left",
                maxWidth: 600,
                overflowX: "auto",
                color: "#991b1b",
              }}
            >
              {this.state.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
