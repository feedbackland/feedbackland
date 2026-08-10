"use client";

import { useEffect, useState } from "react";
import { useIsDrawerEmbed } from "@/providers/embed";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

/**
 * SSR-safe desktop breakpoint check (>= 768px, matching Tailwind's `md`).
 *
 * The first value has to be a guess — neither the server nor React's hydration
 * render may read the viewport — so it is guessed from what *is* known:
 *
 *  - Inside the slide-in drawer widget, `false`. The drawer panel is capped at
 *    `min(100vw - 40px, 600px)`, so the board is always below the breakpoint
 *    there. Guessing `true` used to swap the whole panel from the desktop
 *    layout (260px sidebar, no mobile toolbar) to the narrow one one frame
 *    after hydration — a full-panel jump on every open.
 *  - Standalone, `true`, which keeps the server markup stable for the common
 *    case and matches every desktop visit.
 *
 * Either way the real viewport is read on mount and reflected from then on.
 *
 * Use this instead of reading `useWindowSize().width` during render:
 * `react-use` reads the live `window.innerWidth` in its state initializer, so
 * the client's first render disagrees with the server's assumed width and
 * triggers a hydration mismatch on viewports narrower than the breakpoint.
 */
export function useIsDesktop(): boolean {
  const isDrawerEmbed = useIsDrawerEmbed();
  const [isDesktop, setIsDesktop] = useState(!isDrawerEmbed);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
