"use client";
import { useEffect } from "react";
import { socialError } from "@/lib/auth/popup-client";
export function PopupDone({
  ticket,
  error,
}: {
  ticket: string | null;
  error: string | null;
}) {
  useEffect(() => {
    if (ticket) {
      try {
        window.opener?.postMessage(
          { type: "feedbackland:popup-ready", ticket },
          window.location.origin,
        );
      } catch {}
    }
    const timer = setTimeout(() => window.close(), 600);
    return () => clearTimeout(timer);
  }, [ticket]);
  // This page neither inspects a session nor binds a ticket. The callback did
  // all authoritative work; this message only wakes the opener's polling loop.
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-semibold">
        {error ? "Sign-in could not complete" : "Signed in"}
      </h1>
      <p>
        {error
          ? socialError(error)
          : "You can close this tab and return to the feedback board."}
      </p>
    </main>
  );
}
