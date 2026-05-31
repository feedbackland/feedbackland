"use client";

import { useEffect, useState } from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

/**
 * SSR-safe desktop breakpoint check (>= 768px, matching Tailwind's `md`).
 *
 * Returns `true` on the server and on the first client render so the markup
 * matches the server-rendered HTML (no hydration mismatch), then reflects the
 * real viewport after mount.
 *
 * Use this instead of reading `useWindowSize().width` during render:
 * `react-use` reads the live `window.innerWidth` in its state initializer, so
 * the client's first render disagrees with the server's assumed width and
 * triggers a hydration mismatch on viewports narrower than the breakpoint —
 * e.g. inside the embedded feedback drawer.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
