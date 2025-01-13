import { NextRequest, NextResponse } from "next/server";

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
  const host = req.headers.get("host") || ""; // e.g. tenant1.localhost:3000 or tenant1.feedbackland.com
  const currentUrl = req.nextUrl.clone();
  const domainParts = host.split(".");
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN as string; // e.g. localhost or feedbackland.com
  const subdomain =
    host.includes(`.${rootDomain}`) && domainParts[0] !== "www"
      ? domainParts[0]
      : null;
  const pathname = currentUrl.pathname;
  const searchParams = currentUrl.searchParams.toString();
  const path = `${pathname}${
    searchParams.length > 0 ? `?${searchParams}` : ""
  }`;
  const response = subdomain
    ? NextResponse.rewrite(new URL(`/${subdomain}${path}`, req.url))
    : NextResponse.next();
  response.headers.set("x-org-subdomain", subdomain || "");
  return response;
}
