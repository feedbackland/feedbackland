import { NextRequest, NextResponse } from "next/server";
import { getSubdomain } from "@/lib/utils";

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

export async function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl.clone();
  const host = req.headers.get("host");
  const { pathname, search } = url;
  const isLocalhost = host?.includes("localhost");
  const urlString = url.toString();
  const subdomain = getSubdomain(urlString);

  if (!isLocalhost) {
    const newUrl = `/${subdomain}${pathname}${search}`;
    response = NextResponse.rewrite(new URL(newUrl, req.url));
  }

  return response;
}
