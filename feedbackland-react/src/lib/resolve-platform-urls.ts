import { validateUUID } from "./utils";

const DEFAULT_BOARD_DOMAIN = "feedbackland.com";
const DEFAULT_API_ENDPOINT = "https://api.feedbackland.com/api/feedback/create";

export type ResolvedPlatformUrls = {
  /** Origin + path of the iframe-embeddable feedback board (no query string). */
  boardUrl: string | undefined;
  /** Endpoint for direct feedback submissions from the popover widget. */
  apiUrl: string;
  /** Origin component of `boardUrl` — used as the penpal `allowedOrigins` entry. */
  origin: string | undefined;
};

export function resolvePlatformUrls({
  platformId,
  url,
}: {
  platformId?: string;
  url?: string;
}): ResolvedPlatformUrls {
  if (url) {
    try {
      const parsed = new URL(url);
      const base = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
      return {
        boardUrl: base,
        apiUrl: `${base}/api/feedback/create`,
        origin: parsed.origin,
      };
    } catch {
      console.warn("[feedbackland-react] Invalid `url` prop, ignoring:", url);
    }
  }

  if (platformId && validateUUID(platformId)) {
    const boardUrl = `https://${platformId}.${DEFAULT_BOARD_DOMAIN}`;
    return {
      boardUrl,
      apiUrl: DEFAULT_API_ENDPOINT,
      origin: new URL(boardUrl).origin,
    };
  }

  return {
    boardUrl: undefined,
    apiUrl: DEFAULT_API_ENDPOINT,
    origin: undefined,
  };
}
