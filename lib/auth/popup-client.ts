"use client";
import { acceptEmbeddedCredential, embeddedCredentialSnapshot } from "./client";
import type { ResolvedSurface } from "../embed-surface";
export type SocialProvider = "google" | "microsoft" | "oidc";
export type PopupFlow = { ticket: string; secret: string; h: string };
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export async function preparePopupFlow(): Promise<PopupFlow> {
  const ticket = hex(crypto.getRandomValues(new Uint8Array(16)));
  const secret = hex(crypto.getRandomValues(new Uint8Array(16)));
  const h = hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
    ),
  );
  return { ticket, secret, h };
}
export function socialError(code?: string) {
  if (code === "account_not_linked")
    return "This email is already registered. Sign in with the method you used before.";
  if (code === "access_denied")
    return "Sign-in was declined. You can try again.";
  if (
    [
      "state_mismatch",
      "invalid_callback_request",
      "state_not_found",
      "state_expired",
    ].includes(code ?? "")
  )
    return "The sign-in request expired or could not be verified. Please try again.";
  return "Sign-in could not be completed. Please try again.";
}
export async function openSocialPopup(
  provider: SocialProvider,
  flow: PopupFlow,
  surface: ResolvedSurface,
  signal: AbortSignal,
  onOpen?: (href: string) => void,
) {
  signal.throwIfAborted();
  const snapshot = embeddedCredentialSnapshot();
  const mode = surface === "drawer" ? "embedded" : "first-party";
  const query = new URLSearchParams({
    provider,
    ticket: flow.ticket,
    h: flow.h,
    mode,
  });
  // No await before this call: the hash was prepared when the dialog opened.
  const href = `/auth/popup?${query}`;
  window.open(href, "_blank", "popup,width=520,height=720");
  // Enforcing COOP can return no usable WindowProxy even though the tab opens.
  // Neither a missing handle nor popup.closed can decide whether to poll.
  onOpen?.(href);
  const deadline = Date.now() + 10 * 60_000;
  let interval = 1000;
  let wake: (() => void) | undefined;
  const message = (event: MessageEvent) => {
    if (
      event.origin === window.location.origin &&
      event.data?.type === "feedbackland:popup-ready" &&
      event.data.ticket === flow.ticket
    )
      wake?.();
  };
  window.addEventListener("message", message);
  const wait = () =>
    new Promise<void>((yes, no) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        wake = undefined;
        yes();
      };
      const abort = () => {
        clearTimeout(timer);
        wake = undefined;
        no(signal.reason);
      };
      const timer = setTimeout(
        finish,
        Math.min(interval, Math.max(0, deadline - Date.now())),
      );
      wake = finish;
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  try {
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      let response: Response;
      try {
        response = await fetch("/api/auth/popup-handoff/claim", {
          method: "POST",
          credentials: mode === "embedded" ? "omit" : "include",
          headers: {
            "content-type": "application/json",
            ...(mode === "embedded"
              ? { "x-feedbackland-scope": "embedded" }
              : {}),
          },
          body: JSON.stringify({ ticket: flow.ticket, secret: flow.secret }),
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(
              Math.min(10_000, Math.max(1, deadline - Date.now())),
            ),
          ]),
        });
      } catch {
        signal.throwIfAborted();
        interval = Math.min(3000, interval * 2);
        await wait();
        continue;
      }
      // The opener may poll before the user confirms/reserves the ticket.
      if ([202, 404, 429].includes(response.status)) {
        interval = Math.min(
          3000,
          interval * (response.status === 429 ? 2 : 1.25),
        );
        await wait();
        continue;
      }
      if (!response.ok) throw new Error(socialError());
      const result: { token?: string; done?: boolean; error?: string } =
        await response.json();
      signal.throwIfAborted();
      if (result.error) throw new Error(socialError(result.error));
      if (mode === "embedded") {
        if (
          typeof result.token !== "string" ||
          !acceptEmbeddedCredential(snapshot, result.token)
        )
          throw new Error(
            "Your session changed while sign-in was open. Please try again.",
          );
      } else if (result.done !== true) throw new Error(socialError());
      return;
    }
    throw new Error("Sign-in timed out. Please try again.");
  } finally {
    window.removeEventListener("message", message);
    wake?.();
    // COOP can sever the opener. popup.closed is deliberately never read.
  }
}
