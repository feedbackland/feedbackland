"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn, validateUUID } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { FocusOn } from "react-focus-on";
import { useDarkMode } from "./hooks/use-dark-mode";

const IFRAME_TIMEOUT_MS = 15000;

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
    const isDarkMode = useDarkMode();

    // Stable per-instance id for the dialog's accessible-name target.
    const titleId = useMemo(
      () => `fl-overlay-title-${Math.random().toString(36).slice(2, 11)}`,
      [],
    );

    // ----- Resolve the iframe source URL -----
    const platformUrl = useMemo(() => {
      const mode = isDarkMode ? "dark" : "light";

      if (url) {
        try {
          new URL(url); // validate parses
          return `${url}?mode=${mode}`;
        } catch {
          console.warn(
            "[feedbackland-react] Invalid `url` prop, ignoring:",
            url,
          );
        }
      }

      if (platformId && validateUUID(platformId)) {
        return `https://${platformId}.feedbackland.com?mode=${mode}`;
      }

      return undefined;
    }, [platformId, isDarkMode, url]);

    // Reset iframe load/error state when the URL changes (dark-mode toggle)
    // or when the user retries by bumping iframeKey.
    useEffect(() => {
      setIframeLoaded(false);
      setIframeError(false);
      setIframeTimedOut(false);
    }, [platformUrl, iframeKey]);

    // ----- Connection pre-warming -----
    // Inject a deduplicated preconnect link so the browser resolves DNS +
    // establishes TCP+TLS before the iframe needs to fetch content.
    useEffect(() => {
      let domain: string | null = null;
      try {
        if (url) {
          domain = new URL(url).origin;
        } else if (platformId && validateUUID(platformId)) {
          domain = `https://${platformId}.feedbackland.com`;
        }
      } catch {
        // Invalid `url` — already warned above; skip preconnect.
      }

      if (!domain) return;
      return acquirePreconnect(domain);
    }, [platformId, url]);

    // ----- Iframe load timeout -----
    // If the iframe doesn't fire `onLoad` within IFRAME_TIMEOUT_MS after the
    // overlay opens, surface an error panel so the user isn't stuck on shimmer.
    useEffect(() => {
      if (!isOpened || iframeLoaded || iframeError || iframeTimedOut) return;
      const id = window.setTimeout(() => {
        setIframeTimedOut(true);
      }, IFRAME_TIMEOUT_MS);
      return () => window.clearTimeout(id);
    }, [isOpened, iframeLoaded, iframeError, iframeTimedOut]);

    // ----- Handlers -----
    const handleOpen = useCallback(() => {
      if (platformUrl) {
        setIsOpened(true);
      }
    }, [platformUrl]);

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

    const showError = iframeError || iframeTimedOut;

    return (
      <>
        {/* Trigger — host's own button is provided as children */}
        <div onClick={handleOpen} className={cn("", { dark: isDarkMode })}>
          {children}
        </div>

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
                    <iframe
                      key={iframeKey}
                      src={platformUrl}
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                      className={cn(
                        "fl:w-full fl:h-full fl:overflow-hidden fl:border-0 fl:border-none fl:outline-none fl:ring-0 fl:shadow-none fl:m-0 fl:p-0",
                      )}
                      loading="eager"
                      allow="clipboard-write"
                      title="Share your feedback"
                    />

                    {/* Shimmer skeleton while the iframe loads (and no error) */}
                    {isOpened && !iframeLoaded && !showError && (
                      <div
                        className="fl:absolute fl:inset-0 fl:z-10 fl:bg-background fl:flex fl:flex-col fl:gap-4 fl:p-6 fl:overflow-hidden"
                        aria-hidden="true"
                      >
                        {/* Header shimmer */}
                        <div className="fl:flex fl:items-center fl:justify-between">
                          <div className="fl:h-6 fl:w-28 fl:rounded-md fl:bg-muted fl:animate-pulse" />
                          <div className="fl:flex fl:gap-2">
                            <div className="fl:size-8 fl:rounded-md fl:bg-muted fl:animate-pulse" />
                            <div className="fl:size-8 fl:rounded-md fl:bg-muted fl:animate-pulse" />
                          </div>
                        </div>
                        {/* Body shimmer */}
                        <div className="fl:flex-1 fl:flex fl:flex-col fl:gap-3 fl:mt-2">
                          <div className="fl:h-4 fl:w-full fl:rounded fl:bg-muted fl:animate-pulse" />
                          <div className="fl:h-4 fl:w-3/4 fl:rounded fl:bg-muted fl:animate-pulse" />
                          <div className="fl:h-4 fl:w-5/6 fl:rounded fl:bg-muted fl:animate-pulse" />
                          <div className="fl:h-12 fl:w-full fl:rounded-lg fl:bg-muted fl:animate-pulse fl:mt-4" />
                          <div className="fl:h-12 fl:w-full fl:rounded-lg fl:bg-muted fl:animate-pulse" />
                          <div className="fl:h-12 fl:w-full fl:rounded-lg fl:bg-muted fl:animate-pulse" />
                        </div>
                      </div>
                    )}

                    {/* Error fallback when the iframe fails or times out */}
                    {showError && (
                      <div
                        role="alert"
                        className="fl:absolute fl:inset-0 fl:z-10 fl:bg-background fl:flex fl:flex-col fl:items-center fl:justify-center fl:gap-3 fl:p-6 fl:text-center"
                      >
                        <div className="fl:text-base fl:font-semibold fl:text-foreground">
                          We couldn't load the feedback board
                        </div>
                        <div className="fl:text-sm fl:text-muted-foreground fl:max-w-sm">
                          {iframeTimedOut
                            ? "Loading took longer than expected. Please check your connection and try again."
                            : "Something went wrong while loading. Please try again."}
                        </div>
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
