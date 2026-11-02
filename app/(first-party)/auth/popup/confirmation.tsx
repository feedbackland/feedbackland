"use client";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { socialError, type SocialProvider } from "@/lib/auth/popup-client";

export function PopupConfirmation({
  provider,
  ticket,
  h,
  mode,
  title,
}: {
  provider: SocialProvider;
  ticket: string;
  h: string;
  mode: "embedded" | "first-party";
  title: string;
}) {
  const embedding = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const ancestor = window.opener?.location.ancestorOrigins?.[0];
        return ancestor ? new URL(ancestor).origin : null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await fetch("/api/auth/popup-handoff/start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket, h, mode }),
      });
      if (!started.ok)
        throw new Error(
          "This sign-in request could not be started. Close this tab and try again.",
        );
      const result = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: `/auth/popup/done?ticket=${ticket}`,
          errorCallbackURL: `/auth/popup/done?ticket=${ticket}`,
          disableRedirect: true,
        }),
      });
      const data: { url?: string } = await result.json();
      if (!result.ok || typeof data.url !== "string")
        throw new Error(socialError());
      const url = new URL(data.url);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error(socialError());
      window.location.assign(url.href);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : socialError());
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Sign in to {title}?</h1>
      <p>
        {embedding
          ? `You opened sign-in from ${embedding}.`
          : "Continue only if you just clicked Sign in on a feedback widget or this board."}
      </p>
      <p>
        Continue to choose your account with{" "}
        {provider === "oidc"
          ? "your sign-in provider"
          : provider === "google"
            ? "Google"
            : "Microsoft"}
        .
      </p>
      {error && <p role="alert">{error}</p>}
      <Button type="button" loading={busy} onClick={() => void signIn()}>
        Continue
      </Button>
    </main>
  );
}
