"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <h1>Feedback could not load</h1>
        <p>Please try again.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
        <button
          onClick={() => {
            const current = new URL(window.location.href);
            current.pathname = "/";
            current.hash = "";
            window.location.assign(current.toString());
          }}
        >
          Back to feedback
        </button>
      </body>
    </html>
  );
}
