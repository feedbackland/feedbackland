import { NextRequest, NextResponse } from "next/server";
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    "/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
};

const getSubdomainFromUrl = (urlString: string) => {
  const { hostname, pathname } = new URL(urlString);

  if (hostname.includes("localhost")) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : "";
  }

  const parts = hostname.split(".");
  return parts.length > 2 ? parts[0] : "";
};

const getMaindomainFromUrl = (urlString: string) => {
  const { hostname } = new URL(urlString);

  if (hostname.includes("localhost")) {
    return "localhost";
  }

  const parts = hostname.split(".");
  return parts.length <= 2 ? hostname : parts.slice(-2).join(".");
};

export function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl;
  const { hostname, pathname, search, origin } = url;
  const isLocalhost = hostname.includes("localhost");
  const subdomain = getSubdomainFromUrl(url.toString());
  const maindomain = getMaindomainFromUrl(url.toString());
  const platformUrl = isLocalhost ? `${origin}/${subdomain}` : origin;

  // Rewrite request if valid subdomain exists
  if (!isLocalhost && subdomain && !["auth", "public"].includes(subdomain)) {
    const newUrl = `/${subdomain}${pathname}${search}`;
    response = NextResponse.rewrite(new URL(newUrl, req.url));
  }

  const cookieSettings = {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  } satisfies Partial<ResponseCookie>;

  response.cookies.set("subdomain", subdomain, cookieSettings);
  response.cookies.set("maindomain", maindomain, cookieSettings);
  response.cookies.set("platform-url", platformUrl, cookieSettings);

  return response;
}
