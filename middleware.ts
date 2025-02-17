import { NextRequest, NextResponse } from "next/server";
import { getSubdomainFromUrl } from "./lib/utils";

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

export function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl;
  const { hostname, pathname, search } = url;
  const isLocalhost = hostname.includes("localhost");
  const subdomain = getSubdomainFromUrl(url.toString());

  // Rewrite request if valid subdomain exists
  if (!isLocalhost && subdomain && subdomain !== "auth") {
    const newUrl = `/${subdomain}${pathname}${search}`;
    response = NextResponse.rewrite(new URL(newUrl, req.url));
  }

  response.headers.set("x-subdomain", subdomain || "");

  return response;
}
