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
  const host = req.headers.get("host") || ""; // e.g. "new.localhost:3000"
  const { pathname } = req.nextUrl.clone();
  const domainParts = host.split(".");
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN as string;
  const subdomain =
    host.includes(`.${rootDomain}`) && domainParts[0] !== "www"
      ? domainParts[0]
      : null;
  const response = subdomain
    ? NextResponse.rewrite(new URL(`/${subdomain}${pathname}`, req.url))
    : NextResponse.next();
  response.headers.set("x-org-subdomain", subdomain || "");
  return response;
}
