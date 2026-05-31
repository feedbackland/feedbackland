"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { FocusOn } from "react-focus-on";
import { useTheme } from "./hooks/use-theme";
import { resolvePlatformUrls } from "./lib/resolve-platform-urls";
import { BoardSkeleton } from "./BoardSkeleton";

const IFRAME_TIMEOUT_MS = 15000;

// Once the iframe's document has loaded, how long to wait before revealing it
// anyway (a safety net so the panel can never get stuck on the shimmer):
//  - LONG, when the board has announced it speaks the readiness protocol — we
//    know a `ready` signal is coming, so wait it out. Kept below
//    IFRAME_TIMEOUT_MS so a genuinely failed load still surfaces as an error.
//  - SHORT, when no protocol handshake was seen (an older / self-hosted board
//    that never signals readiness) — degrade gracefully to roughly the legacy
//    "reveal once loaded" behaviour instead of stalling on the shimmer.
const READY_FALLBACK_LONG_MS = 12000;
const READY_FALLBACK_SHORT_MS = 2500;

// Cross-origin readiness protocol exchanged with the embedded board:
//  - "loading": posted at parse time (board boot script) — "I speak this
//    protocol, wait for my ready".
//  - "ready":   posted once the board has fully loaded (platform-loading-gate).
// We keep the shimmer up until "ready" so the user never sees the board's own
// multi-stage hydration/data-loading shifts.
const LOADING_MESSAGE = "feedbackland:loading";
const READY_MESSAGE = "feedbackland:ready";

// Tells the embedded board it is being rendered inside this slide-in drawer
// (rather than standalone), so it can tailor its chrome — currently it hides its
// page header so the feedback form is the topmost element. An explicit signal,
// not iframe-detection, so a board embedded some other way is unaffected. Read
// on the board side by `EmbedProvider` (providers/embed.tsx).
const EMBED_SURFACE = "drawer";

// Module-level reference counter so multiple <FeedbackButton> instances
// targeting the same domain share a single <link rel="preconnect"> element
// rather than duplicating it on every mount.
const preconnectRefs = new Map<
  string,
  { count: number; element: HTMLLinkElement }
>();

function acquirePreconnect(domain: string): () => void {
  if (typeof document === "undefined") return () => {};

  const existing = preconnectRefs.get(domain);
  if (existing) {
    existing.count++;
  } else {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = domain;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    preconnectRefs.set(domain, { count: 1, element: link });
  }

  return () => {
    const entry = preconnectRefs.get(domain);
    if (!entry) return;
    entry.count--;
    if (entry.count <= 0) {
      try {
        document.head.removeChild(entry.element);
      } catch {
        // Already detached — fine.
      }
      preconnectRefs.delete(domain);
    }
  };
}

/**
 * OverlayWidget — A slide-in drawer widget that embeds a Feedbackland board
 * via iframe. Performance optimizations:
 *  - Portal + iframe are always mounted so the browser preloads content eagerly
 *  - A `<link rel="preconnect">` hint is injected to warm up the connection
 *    (deduped across multiple instances pointing at the same origin)
 *  - Visibility is toggled via CSS rather than conditional rendering
 *  - GPU-accelerated transforms with layout isolation for smooth animation
 *  - Iframe load failures and timeouts are surfaced as a retryable error panel
 */
export const OverlayWidget = memo(
  ({
    platformId,
    url,
    children,
  }: {
    platformId: string;
    url?: string;
    children: React.ReactNode;
  }) => {
    const [isOpened, setIsOpened] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [iframeTimedOut, setIframeTimedOut] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    // True once the board has posted its "ready" signal (or we've waited long
    // enough). This — not the iframe's `onLoad` — is what dismisses the shimmer,
    // because `onLoad` fires at document load, long before the board's React app
    // has hydrated and fetched its data.
    const [platformReady, setPlatformReady] = useState(false);
    const [readyFallback, setReadyFallback] = useState(false);
    // Whether the board has announced it speaks the readiness protocol. Decides
    // how long we're willing to wait for the `ready` signal before giving up.
    const [protocolDetected, setProtocolDetected] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const theme = useTheme();
    const isDarkMode = theme === "dark";

    // The board is safe to show once it signalled ready (or the fallback elapsed).
    const contentReady = platformReady || readyFallback;

    // Stable per-instance id for the dialog's accessible-name target.
    const titleId = useMemo(
      () => `fl-overlay-title-${Math.random().toString(36).slice(2, 11)}`,
      [],
    );

    // ----- Resolve the iframe source URL -----
    const { boardUrl, origin: boardOrigin } = useMemo(
      () => resolvePlatformUrls({ platformId, url }),
      [platformId, url],
    );

    const platformUrl = useMemo(() => {
      if (!boardUrl) return undefined;
      const params = new URLSearchParams({
        mode: isDarkMode ? "dark" : "light",
        embed: EMBED_SURFACE,
      });
      return `${boardUrl}?${params.toString()}`;
    }, [boardUrl, isDarkMode]);

    // True when neither a parseable `url` nor a valid-UUID `platformId` was
    // supplied — the trigger still works but the panel renders a configuration
    // error instead of an iframe.
    const hasConfigError = !boardUrl;

    // Log a clear, single dev-time error when the component is rendered with
    // unresolvable configuration. Helps integrators catch typos / wrong props
    // without having to click the trigger first.
    useEffect(() => {
      if (hasConfigError) {
        // eslint-disable-next-line no-console
        console.error(
          "[feedbackland-react] <FeedbackButton> cannot resolve a board URL — " +
            "pass a valid UUID `platformId` or a fully-qualified `url`. " +
            `Received platformId=${JSON.stringify(platformId)}, url=${JSON.stringify(url)}.`,
        );
      }
    }, [hasConfigError, platformId, url]);

    // Reset iframe load/error/ready state when the URL changes (dark-mode toggle)
    // or when the user retries by bumping iframeKey.
    useEffect(() => {
      setIframeLoaded(false);
      setIframeError(false);
      setIframeTimedOut(false);
      setPlatformReady(false);
      setReadyFallback(false);
      setProtocolDetected(false);
    }, [platformUrl, iframeKey]);

    // ----- Board readiness signal -----
    // The board posts `{ type: "feedbackland:ready" }` to its parent once it has
    // fully loaded. We listen on mount (so a board that finishes loading while
    // still in the background — the iframe is always mounted — is captured before
    // the user even opens the panel, giving an instant, shift-free reveal). We
    // verify `event.source` is *our* iframe rather than checking origin, because
    // the board may have redirected to a different sub-domain than the one we
    // navigated to (the `<uuid>.feedbackland.com` → org-subdomain redirect).
    useEffect(() => {
      const onMessage = (event: MessageEvent) => {
        const frame = iframeRef.current;
        if (!frame || event.source !== frame.contentWindow) return;
        if (!event.data || typeof event.data !== "object") return;
        if (event.data.type === LOADING_MESSAGE) {
          setProtocolDetected(true);
        } else if (event.data.type === READY_MESSAGE) {
          // A board that signals ready necessarily speaks the protocol, even if
          // the earlier "loading" ping was missed.
          setProtocolDetected(true);
          setPlatformReady(true);
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, []);

    // ----- Readiness fallback -----
    // If the document loaded but no ready signal arrives in time, reveal anyway
    // so the panel can never get stuck on the shimmer. We wait longer when the
    // board has announced the protocol (a `ready` is coming) than when it hasn't
    // (an older board that will never signal — degrade gracefully).
    useEffect(() => {
      if (
        !isOpened ||
        !iframeLoaded ||
        platformReady ||
        readyFallback ||
        hasConfigError
      )
        return;
      const id = window.setTimeout(
        () => {
          setReadyFallback(true);
        },
        protocolDetected ? READY_FALLBACK_LONG_MS : READY_FALLBACK_SHORT_MS,
      );
      return () => window.clearTimeout(id);
    }, [
      isOpened,
      iframeLoaded,
      platformReady,
      readyFallback,
      protocolDetected,
      hasConfigError,
    ]);

    // ----- Connection pre-warming -----
    // Inject a deduplicated preconnect link so the browser resolves DNS +
    // establishes TCP+TLS before the iframe needs to fetch content.
    useEffect(() => {
      if (!boardOrigin) return;
      return acquirePreconnect(boardOrigin);
    }, [boardOrigin]);

    // ----- Iframe load timeout -----
    // If the iframe doesn't fire `onLoad` within IFRAME_TIMEOUT_MS after the
    // overlay opens, surface an error panel so the user isn't stuck on shimmer.
    // Skipped when there's no iframe to wait on (config error case).
    useEffect(() => {
      if (
        !isOpened ||
        iframeLoaded ||
        iframeError ||
        iframeTimedOut ||
        hasConfigError
      )
        return;
      const id = window.setTimeout(() => {
        setIframeTimedOut(true);
      }, IFRAME_TIMEOUT_MS);
      return () => window.clearTimeout(id);
    }, [isOpened, iframeLoaded, iframeError, iframeTimedOut, hasConfigError]);

    // ----- Handlers -----
    // Always allow opening — when configuration is invalid the panel will
    // render an inline error so the user (and integrator) gets feedback
    // instead of an unresponsive button.
    const handleOpen = useCallback(() => {
      setIsOpened(true);
    }, []);

    const handleClose = useCallback(() => {
      setIsOpened(false);
    }, []);

    const handleIframeLoad = useCallback(() => {
      setIframeLoaded(true);
    }, []);

    const handleIframeError = useCallback(() => {
      setIframeError(true);
    }, []);

    const handleRetry = useCallback(() => {
      setIframeKey((k) => k + 1);
    }, []);

    const showError = iframeError || iframeTimedOut || hasConfigError;

    return (
      <>
        {/* Trigger — Slot merges the open handler into whatever element the
            host passes (a native <button>, an asChild element, etc.) so
            keyboard activation behaves exactly like the unwrapped trigger
            would. Same semantics as PopoverWidget's Radix triggers. */}
        <Slot onClick={handleOpen} className={cn({ dark: isDarkMode })}>
          {children}
        </Slot>

        {/* Portal: always mounted so the iframe starts loading immediately */}
        {typeof document !== "undefined" &&
          createPortal(
            <>
              {/* Semi-transparent backdrop — only visible when opened */}
              <div
                onClick={handleClose}
                className={cn(
                  "fl:fixed fl:inset-0 fl:z-2147483646 fl:transition-opacity fl:duration-300 fl:ease-out",
                  "fl:bg-black/65 fl:backdrop-blur-xs",
                  {
                    "fl:opacity-0 fl:pointer-events-none": !isOpened,
                    "fl:opacity-100": isOpened,
                  },
                )}
                aria-hidden={!isOpened}
              />

              <FocusOn
                enabled={isOpened}
                onClickOutside={handleClose}
                onEscapeKey={handleClose}
                crossFrame={true}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  className={cn(
                    "fl-scope",
                    // Base positioning: always in the DOM, off-screen when closed
                    "fl:fixed fl:top-0 fl:bottom-0 fl:right-0 fl:w-full fl:h-full",
                    "fl:max-w-[calc(100vw-40px)] fl:sm:max-w-[600px] fl:z-2147483647",
                    // GPU-accelerated transform with layout isolation
                    "fl:transform-gpu fl:transition-transform fl:duration-300 fl:ease-out",
                    "fl:will-change-transform fl:contain-layout fl:contain-style fl:contain-paint",
                    "fl:bg-background",
                    // Slide states
                    {
                      "fl:translate-x-full fl:invisible fl:pointer-events-none":
                        !isOpened,
                      "fl:translate-x-0 fl:visible": isOpened,
                      "fl:border-l-1 fl:border-border": isDarkMode,
                      dark: isDarkMode,
                    },
                  )}
                >
                  {/* Visually-hidden accessible name for the dialog */}
                  <h2 id={titleId} className="fl:sr-only">
                    Share your feedback
                  </h2>

                  <div className="fl:w-full fl:h-full fl:relative">
                    {/* Iframe is only rendered when the config is valid.
                        Otherwise the showError block below takes over and
                        explains what went wrong. */}
                    {!hasConfigError && (
                      <iframe
                        key={iframeKey}
                        ref={iframeRef}
                        src={platformUrl}
                        onLoad={handleIframeLoad}
                        onError={handleIframeError}
                        className={cn(
                          "fl:w-full fl:h-full fl:overflow-hidden fl:border-0 fl:border-none fl:outline-none fl:ring-0 fl:shadow-none fl:m-0 fl:p-0",
                        )}
                        loading="eager"
                        // Sandbox: defense-in-depth on top of cross-origin SOP.
                        // Allow scripts + same-origin (board auth/storage),
                        // form submission, and popups (for OAuth flows /
                        // open-in-new-tab links). `allow-popups-to-escape-sandbox`
                        // lets those popups load as normal pages.
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                        allow="clipboard-write"
                        title="Share your feedback"
                      />
                    )}

                    {/* Skeleton mirroring the board's narrow layout, shown until
                        the board signals it's fully ready (and no error). Holding
                        it past the iframe's `onLoad` until the board's ready signal
                        hides the board's multi-stage hydration/data-loading shifts,
                        and matching the board's shape makes the reveal seamless. */}
                    {isOpened && !contentReady && !showError && <BoardSkeleton />}

                    {/* Error fallback for both iframe load failures and
                        unresolvable configuration. Config errors hide the
                        retry button (retry can't help bad props) and show
                        an integrator-targeted message instead. */}
                    {showError && (
                      <div
                        role="alert"
                        className="fl:absolute fl:inset-0 fl:z-10 fl:bg-background fl:flex fl:flex-col fl:items-center fl:justify-center fl:gap-3 fl:p-6 fl:text-center"
                      >
                        <div className="fl:text-base fl:font-semibold fl:text-foreground">
                          {hasConfigError
                            ? "Feedback widget misconfigured"
                            : "We couldn't load the feedback board"}
                        </div>
                        <div className="fl:text-sm fl:text-muted-foreground fl:max-w-sm">
                          {hasConfigError
                            ? "The widget needs a valid `platformId` (UUID) or `url` prop. Check the developer console for details."
                            : iframeTimedOut
                              ? "Loading took longer than expected. Please check your connection and try again."
                              : "Something went wrong while loading. Please try again."}
                        </div>
                        {!hasConfigError && (
                          <div className="fl:flex fl:items-center fl:gap-2 fl:mt-2">
                            <button
                              type="button"
                              onClick={handleRetry}
                              className="fl:inline-flex fl:items-center fl:justify-center fl:rounded-md fl:bg-primary fl:text-primary-foreground fl:text-sm fl:font-medium fl:px-4 fl:h-9 fl:cursor-pointer fl:hover:bg-primary/90 fl:focus-visible:outline-2 fl:focus-visible:outline-offset-2 fl:focus-visible:outline-ring"
                            >
                              Try again
                            </button>
                            {platformUrl && (
                              <a
                                href={platformUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="fl:inline-flex fl:items-center fl:justify-center fl:rounded-md fl:border fl:border-border fl:bg-background fl:text-foreground fl:text-sm fl:font-medium fl:px-4 fl:h-9 fl:hover:bg-accent fl:focus-visible:outline-2 fl:focus-visible:outline-offset-2 fl:focus-visible:outline-ring"
                              >
                                Open in new tab
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Close button — visible outside the widget on desktop */}
                    <button
                      type="button"
                      aria-label="Close feedback panel"
                      onClick={handleClose}
                      className="fl:[all:unset] fl:flex! fl:items-center! fl:justify-center! fl:shrink-0! fl:appearance-none! fl:bg-transparent! fl:border-none! fl:p-0! fl:m-0! fl:size-6! fl:cursor-pointer! fl:absolute! fl:top-[18px]! fl:-left-[34px]! fl:text-white! fl:hover:text-white! fl:rounded-md! fl:hover:bg-black/50! fl:focus-visible:outline-2! fl:focus-visible:outline-offset-2! fl:focus-visible:outline-white!"
                    >
                      <XIcon className="fl:size-5!" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </FocusOn>
            </>,
            document.body,
          )}
      </>
    );
  },
);

OverlayWidget.displayName = "OverlayWidget";
