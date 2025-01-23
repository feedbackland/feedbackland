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
  let response = NextResponse.next();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN as string; // e.g. localhost or feedbackland.com
  const host = req.headers.get("host") || ""; // e.g. tenant1.localhost:3000 or tenant1.feedbackland.com
  const nextUrl = req.nextUrl.clone();
  const pathname = nextUrl.pathname;
  const searchParams = nextUrl.searchParams.toString();
  const hasSearchParams = searchParams.length > 0;
  const isLocalhost = host.includes("localhost");
  const subdomain = isLocalhost
    ? pathname.split("/")?.filter((i) => i !== "")?.[0]
    : host
        .replace(rootDomain, "")
        ?.split(".")
        ?.filter((i) => i !== "")?.[0];
  const ignoreList = ["auth"];

  if (
    !isLocalhost &&
    subdomain &&
    subdomain.length > 0 &&
    !ignoreList.includes(subdomain)
  ) {
    const path = `${pathname}${hasSearchParams ? `?${searchParams}` : ""}`;
    response = NextResponse.rewrite(new URL(`/${subdomain}${path}`, req.url));
  }

  response.headers.set("x-url", req.url);
  response.headers.set("x-pathname", pathname);
  response.headers.set("x-subdomain", subdomain);

  return response;
}
