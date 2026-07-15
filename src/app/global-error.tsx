"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Root-level crash screen. Reports the error, then offers a reload. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            The error has been reported and we&apos;re on it. Try reloading
            the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "#171717",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
