import React, { useEffect, useRef } from "react";

export type CrossOriginMode = "trap" | "allow" | "cooperative";

export type UseFocusLockOptions = {
  enabled?: boolean; // whether the lock is active
  crossOriginIframes?: CrossOriginMode; // how to handle cross-origin iframes
  iframeSelector?: string; // selector to find iframes inside the container
  allowList?: (node: HTMLDivElement) => boolean; // allow some nodes outside the container to be focused
};

// Utility: find tabbable elements inside a container
function getTabbableElements(container: HTMLDivElement) {
  const selectors = [
    "a[href]",
    "area[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable]",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  const nodes = Array.from(
    container.querySelectorAll<HTMLDivElement>(selectors)
  );

  // Filter out invisible / zero-size / display:none
  return nodes.filter((n) => {
    try {
      if (!(n instanceof HTMLDivElement)) return false;
      const style = window.getComputedStyle(n);
      if (style.visibility === "hidden" || style.display === "none")
        return false;
      // offsetParent null can mean fixed or invisibility; allow elements that are focusable but maybe positioned
      if (n.offsetParent === null && style.position !== "fixed") {
        return false;
      }
      // for <iframe>, presence is enough; cross-origin handling managed separately
      return true;
    } catch {
      return false;
    }
  });
}

function focusElement(el?: HTMLDivElement | null) {
  if (!el) return;
  try {
    el.focus();
  } catch {
    // ignore
  }
}

/**
 * Hook: useFocusLock
 * - Locks keyboard focus inside a container element while enabled.
 * - Provides strategies for dealing with cross-origin iframes inside the container:
 *   - 'trap' (default): prevents tabbing into the iframe by layering focus-capturing overlays.
 *   - 'allow': lets focus move into the iframe (cannot control what happens inside a cross-origin iframe).
 *   - 'cooperative': expects the iframe content to postMessage focus/blur events to the parent (see example in file).
 */
export function useFocusLock(
  ref: React.RefObject<HTMLDivElement>,
  opts: UseFocusLockOptions = {}
) {
  const {
    enabled = true,
    crossOriginIframes = "trap",
    iframeSelector = "iframe",
    allowList,
  } = opts;

  const overlaysRef = useRef<Map<HTMLIFrameElement, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!enabled || !ref) return;
    const container = ref.current;
    if (!container) return;

    const lastFocusedBeforeLock: HTMLDivElement | null =
      document.activeElement as HTMLDivElement | null;

    // Ensure there's at least one focusable element; otherwise make container tabbable
    const ensureContainerFocusable = () => {
      const tabbables = getTabbableElements(container);
      if (tabbables.length === 0) {
        if (!container.hasAttribute("tabindex"))
          container.setAttribute("tabindex", "-1");
      }
    };

    ensureContainerFocusable();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const tabbables = getTabbableElements(container);
      if (tabbables.length === 0) {
        // If nothing focusable, prevent leaving
        e.preventDefault();
        focusElement(container);
        return;
      }

      const active = document.activeElement as HTMLDivElement | null;

      // If active element is outside and allowed, do nothing
      if (active && !container.contains(active)) {
        if (allowList && allowList(active)) return;
        // If active is an iframe element inside container, we may still want to manage
      }

      // Determine next
      const idx = tabbables.indexOf(active as HTMLDivElement);
      let nextIdx: number;
      if (e.shiftKey) {
        // backward
        if (idx === -1 || idx === 0) nextIdx = tabbables.length - 1;
        else nextIdx = idx - 1;
      } else {
        // forward
        if (idx === -1 || idx === tabbables.length - 1) nextIdx = 0;
        else nextIdx = idx + 1;
      }

      e.preventDefault();
      const next = tabbables[nextIdx];

      // If next is an iframe and cross-origin handling is 'trap', skip it
      if (next instanceof HTMLIFrameElement && crossOriginIframes === "trap") {
        // find next non-iframe tabbable in the chosen direction
        const direction = e.shiftKey ? -1 : 1;
        let i = nextIdx;
        for (let loop = 0; loop < tabbables.length; loop++) {
          i = (i + direction + tabbables.length) % tabbables.length;
          const candidate = tabbables[i];
          if (!(candidate instanceof HTMLIFrameElement)) {
            focusElement(candidate);
            return;
          }
        }
        // fallback: focus container
        focusElement(container);
        return;
      }

      focusElement(next as HTMLDivElement);
    }

    function handleFocusIn() {
      const active = document.activeElement as HTMLDivElement | null;
      if (!active) return;
      if (container.contains(active)) return; // ok

      // If active is allowed by allowList, let it be
      if (allowList && active && allowList(active)) return;

      // If active is an iframe element inside container and crossOriginIframes === 'allow', let it be
      if (
        active instanceof HTMLIFrameElement &&
        container.contains(active) &&
        crossOriginIframes === "allow"
      )
        return;

      // Otherwise, move focus back to the first tabbable or container
      const tabbables = getTabbableElements(container);
      if (tabbables.length > 0) focusElement(tabbables[0]);
      else focusElement(container);
    }

    // When an iframe is cross-origin and we want to trap, create overlay nodes over them
    function attachIframeOverlays() {
      if (crossOriginIframes !== "trap") return;
      const iframes = Array.from(
        container.querySelectorAll<HTMLIFrameElement>(iframeSelector)
      );
      iframes.forEach((iframe) => {
        if (overlaysRef.current.has(iframe)) return; // already

        const overlay = document.createElement("div");
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.position = "absolute";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.pointerEvents = "auto";
        overlay.style.background = "transparent";
        overlay.tabIndex = 0; // make it focusable so tabbing can catch it

        // When overlay is focused we push focus back into the container
        overlay.addEventListener("focus", () => {
          const tabbables = getTabbableElements(container);
          if (tabbables.length > 0) focusElement(tabbables[0]);
          else focusElement(container);
        });

        // Position overlay by placing it into the iframe's offsetParent or by absolute positioning next to it
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = `${iframe.offsetLeft}px`;
        wrapper.style.top = `${iframe.offsetTop}px`;
        wrapper.style.width = `${iframe.offsetWidth}px`;
        wrapper.style.height = `${iframe.offsetHeight}px`;
        wrapper.style.pointerEvents = "none";
        // we place the overlay as child of the same offsetParent as the iframe so stacking works
        wrapper.appendChild(overlay);

        // Try to insert wrapper in the same container (best-effort; if iframe is inside transformed context this may need tuning)
        try {
          iframe.parentElement?.appendChild(wrapper);
          overlaysRef.current.set(iframe, wrapper);
        } catch {
          // fallback: attach overlay as sibling to iframe
          iframe.after(wrapper);
          overlaysRef.current.set(iframe, wrapper);
        }
      });
    }

    function removeIframeOverlays() {
      overlaysRef.current.forEach((wrapper) => {
        wrapper.remove();
      });
      overlaysRef.current.clear();
    }

    // For cooperative mode, listen to messages from iframes (they must postMessage when focus/blur happens)
    function handleMessage(e: MessageEvent) {
      if (!container) return;
      // basic safety: only accept messages with known shape
      const data = e.data;
      if (!data || data?.type !== "focus-trap") return;
      // data: { type: 'focus-trap', event: 'focus'|'blur', id?: string }
      if (data.event === "blur") {
        // If an iframe reports blur and focus moves outside container, re-focus
        const active = document.activeElement as HTMLDivElement | null;
        if (!active || !container.contains(active)) {
          const tabbables = getTabbableElements(container);
          if (tabbables.length > 0) focusElement(tabbables[0]);
          else focusElement(container);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("message", handleMessage, false);

    attachIframeOverlays();

    // Save last focused and move focus into container
    const tabbables = getTabbableElements(container);
    if (tabbables.length > 0) focusElement(tabbables[0]);
    else focusElement(container);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("message", handleMessage, false);
      removeIframeOverlays();
      // restore previous focus
      try {
        if (lastFocusedBeforeLock && lastFocusedBeforeLock.focus)
          lastFocusedBeforeLock.focus();
      } catch {
        // ignore
      }
    };
  }, [ref, enabled, crossOriginIframes, iframeSelector, allowList]);
}

/*
Usage notes (also included as comments in the file):

1) Basic usage:

const containerRef = useRef<HTMLDivElement>(null);
useFocusLock(containerRef, { enabled: true });

Wrap your modal or drawer with <div ref={containerRef}>...</div>

2) Cross-origin iframes:

- trap: the hook will place focus-catching overlays over iframes inside the container so that the Tab key cannot move focus into them. This is the safest option if the iframe is third-party and you do not control its content.

- allow: the hook will allow focusing the iframe element itself. Note: once focus moves into a cross-origin iframe, the parent cannot see or control keyboard events inside the iframe. Tab will be handled by the iframe's document.

- cooperative: if you control the iframe content (even if it's cross-origin), inject a small script into the iframe that posts messages to the parent when the iframe's document gains or loses focus. Example (inside iframe):

  // Inside the iframe (must be same-origin or you must have the ability to add this script to the iframe page)
  window.addEventListener('focus', () => {
    window.parent.postMessage({ type: 'focus-trap', event: 'focus' }, '*');
  });
  window.addEventListener('blur', () => {
    window.parent.postMessage({ type: 'focus-trap', event: 'blur' }, '*');
  });

The hook listens to these messages and can re-focus the parent container when the iframe blurs and the focus would otherwise leave the locked area.

3) Accessibility:

- The trap overlay approach prevents keyboard access to the iframe. If your users need to interact with the iframe using keyboard, prefer cooperative mode and add the postMessage snippet inside the iframe.

- Always ensure the active element receives visible focus styles so keyboard users see where they are.

4) Caveats & limitations:

- Cross-origin iframes cannot be inspected or listened to from the parent page. Any attempt to control their internal focus without cooperation is impossible due to browser security.

- The overlay approach is a robust way to prevent accidental focus into third-party iframes while a focus lock is active, but it also prevents mouse interaction. If you still need mouse interaction but want keyboard lock, consider a more complex UI where users toggle iframe interaction explicitly.

*/
