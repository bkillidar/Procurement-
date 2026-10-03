"use client";

// Last-resort error screen (replaces the root layout, so it brings its own <html>).
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p>Please try again in a moment.</p>
        <button onClick={() => retry()} style={{ padding: "10px 16px", fontSize: 16 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
