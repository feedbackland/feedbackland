/**
 * Which embedding surface, if any, is rendering the board. `null` means the
 * board is standalone (or embedded by something that isn't a Feedbackland
 * widget). Today the only surface is the slide-in drawer widget.
 */
export type EmbedSurface = "drawer" | null;

// Query-param contract with the embedding widget. The slide-in drawer widget
// (feedbackland-react's <OverlayWidget>) appends `?embed=drawer` to the board's
// iframe URL. Keep these two literals in sync with that widget — they are the
// board side of the same handshake as the `?mode=` theme param.
export const EMBED_PARAM = "embed";
export const DRAWER_SURFACE = "drawer";

/**
 * Request header the proxy derives from {@link EMBED_PARAM} and forwards to the
 * server render.
 *
 * A Next.js layout cannot read `searchParams` (only pages can), but the board's
 * embedded-vs-standalone layout is decided in the board layout. Reading the
 * surface off a request header lets the *server* render the drawer layout
 * directly, so the panel's first paint is already final. Resolving it after
 * mount instead would repaint the whole board — desktop→narrow, standalone
 * header→drawer header — one frame after hydration, which is exactly the jump
 * the drawer used to show.
 *
 * The proxy always overwrites this header from the URL, so a caller cannot
 * spoof the surface by sending it themselves.
 */
export const EMBED_HEADER = "x-feedbackland-embed";

/** Narrows an untrusted header/param value to a known surface. */
export function parseEmbedSurface(
  value: string | null | undefined,
): EmbedSurface {
  return value === DRAWER_SURFACE ? DRAWER_SURFACE : null;
}
