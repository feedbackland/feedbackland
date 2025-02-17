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

// export function middleware(req: NextRequest) {
//   const url = req.nextUrl;
//   const { pathname, search } = url;
//   const response = NextResponse.next();
//   const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN as string; //localhost or feedbackland.com
//   const host = req.headers.get("host") || ""; //localhost:3000 or tenant1.feedbackland.com
//   const isLocalhost = host.includes("localhost");

//   // Extract subdomain from either localhost path or host header
//   const subdomain = isLocalhost
//     ? pathname.split("/")[1] // First path segment after /
//     : host.replace(rootDomain, "").split(".")[0];

//   // Rewrite request if valid subdomain exists
//   if (!isLocalhost && subdomain && subdomain !== "auth") {
//     const newUrl = `/${subdomain}${pathname}${search}`;
//     return NextResponse.rewrite(new URL(newUrl, req.url));
//   }

//   response.headers.set("x-subdomain", subdomain || "");

//   return response;
// }

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { hostname, pathname, search } = url;
  const response = NextResponse.next();
  const isLocalhost = hostname.includes("localhost");
  const subdomain = getSubdomainFromUrl(url.toString());

  // Rewrite request if valid subdomain exists
  if (!isLocalhost && subdomain && subdomain !== "auth") {
    const newUrl = `/${subdomain}${pathname}${search}`;
    return NextResponse.rewrite(new URL(newUrl, req.url));
  }

  return response;
}
