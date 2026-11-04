"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import { useAuth, type Session } from "@/hooks/use-auth";
import {
  preparePopupFlow,
  type PopupFlow,
  type SocialProvider,
} from "@/lib/auth/popup-client";

export function SocialSignIn({
  onSuccess,
}: {
  onSuccess(session: Session): void;
}) {
  const { capabilities } = useSettings();
  const { signInWithSocial } = useAuth();
  const [flow, setFlow] = useState<PopupFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [popupHref, setPopupHref] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const enabled = capabilities.socialProviders.length > 0;
  useEffect(() => {
    let active = true;
    if (enabled)
      void preparePopupFlow()
        .then((value) => {
          if (active) setFlow(value);
        })
        .catch(() => {
          if (active)
            setError("Sign-in could not be prepared. Reload and try again.");
        });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [enabled, generation]);
  const signIn = (provider: SocialProvider) => {
    if (!flow || busy) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError(null);
    // The async method opens its popup synchronously before its first await.
    void signInWithSocial(provider, flow, request.signal, setPopupHref)
      .then(onSuccess)
      .catch((failure: unknown) => {
        setError(
          request.signal.aborted
            ? "Sign-in cancelled."
            : failure instanceof Error
              ? failure.message
              : "Sign-in failed.",
        );
      })
      .finally(() => {
        setBusy(false);
        setFlow(null);
        setGeneration((n) => n + 1);
      });
  };
  if (!enabled) return null;
  return (
    <>
      {capabilities.socialProviders.map((provider) => (
        <Button
          type="button"
          variant="outline"
          size="lg"
          key={provider}
          disabled={!flow || busy}
          onClick={() => signIn(provider)}
        >
          Continue with{" "}
          {provider === "oidc"
            ? (capabilities.oidcLabel ?? "Single sign-on")
            : provider === "google"
              ? "Google"
              : "Microsoft"}
        </Button>
      ))}
      {busy && (
        <>
          <p role="status">Complete sign-in in the popup or new tab.</p>
          {popupHref && (
            <a
              href={popupHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
            >
              Open sign-in in a new tab
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => controller.current?.abort()}
          >
            Cancel sign-in
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
