"use client";

import { useEffect } from "react";
import { usePlatformReady } from "@/hooks/use-platform-ready";

// Contentless signal posted to the embedding page (the widget) the moment the
// board has fully loaded, so the widget can hand off from its own shimmer to the
// live board with no visible layout shift. Mirrored by the listener in
// feedbackland-react's OverlayWidget.
const READY_MESSAGE = "feedbackland:ready";

/**
 * Renders nothing. Watches the board's initial load (see `usePlatformReady`) and,
 * once it has fully settled, notifies the host window — but ONLY when actually
 * embedded in an iframe (the widget).
 *
 * There is deliberately no full-screen overlay/skeleton here. When embedded, the
 * widget's own shimmer already covers the iframe until this signal arrives, so a
 * platform-side overlay would be redundant. When standalone, the board simply
 * renders its normal per-section loading states, which already match each page's
 * layout — far cleaner than a one-size-fits-all overlay.
 */
export function PlatformReadySignal() {
  const ready = usePlatformReady();

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: READY_MESSAGE }, "*");
    }
  }, [ready]);

  return null;
}
