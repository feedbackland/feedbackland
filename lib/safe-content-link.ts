/** User/model links must never launch internal authentication/API flows. */
export function isBlockedContentLink(href: string, appUrl?: string) {
  try {
    const base = new URL(appUrl ?? "http://relative.invalid");
    const url = new URL(href, base);
    if (url.origin !== base.origin) return false;
    const decoded = decodeURIComponent(url.pathname).replaceAll("\\", "/");
    const path = new URL(decoded.replace(/^\/+/, "/"), base).pathname;
    return path.startsWith("/auth/") || path.startsWith("/api/");
  } catch {
    return true;
  }
}
