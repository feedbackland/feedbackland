import { NextRequest, NextResponse } from "next/server";
import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { cookieNames } from "@/lib/utils";
import { fetchUpsertOrg } from "@/fetch/upsert-org";
import { validate as uuidValidate } from "uuid";
import { version as uuidVersion } from "uuid";

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

const isUUID = (uuid: string) => {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl;
  const { hostname, pathname, search, origin } = url;
  const isLocalhost = hostname.includes("localhost");
  let subdomain = getSubdomainFromUrl(url.toString());
  const maindomain = getMaindomainFromUrl(url.toString());
  let platformUrl = isLocalhost
    ? `${origin}/${subdomain}`
    : `https://${subdomain}.${maindomain}`;

  if (subdomain && subdomain.length > 0) {
    if (isUUID(subdomain)) {
      const org = await fetchUpsertOrg({
        orgId: subdomain,
        baseUrl: platformUrl,
      });
      subdomain = org.subdomain;
      platformUrl = isLocalhost
        ? `${origin}/${subdomain}`
        : `https://${subdomain}.${maindomain}`;
      response = NextResponse.redirect(platformUrl);
    } else if (!isLocalhost) {
      const newUrl = `/${subdomain}${pathname}${search}`;
      response = NextResponse.rewrite(new URL(newUrl, req.url));
    }
  }

  const cookieSettings = {
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "none",
  } satisfies Partial<ResponseCookie>;

  response.cookies.set(cookieNames.subDomain, subdomain, cookieSettings);
  response.cookies.set(cookieNames.mainDomain, maindomain, cookieSettings);
  response.cookies.set(cookieNames.platformUrl, platformUrl, cookieSettings);

  return response;
}
