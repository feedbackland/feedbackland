import { NextRequest, NextResponse } from "next/server";
import { validate as uuidValidate } from "uuid";
import { version as uuidVersion } from "uuid";
import { getIsSubdirOrg, getMaindomain, getSubdomain } from "@/lib/utils";

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

const isUUID = (uuid: string) => {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
};

const upsertOrg = async ({
  orgId,
  origin,
}: {
  orgId: string;
  origin: string;
}) => {
  try {
    const response = await fetch(`${origin}/api/org/upsert-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const orgSubdomain: string = await response.json();

    return orgSubdomain;
  } catch (error) {
    throw error;
  }
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl.clone();
  const { pathname, search, origin, protocol } = url;
  const urlString = url.toString();
  const isSubdirOrg = getIsSubdirOrg(urlString);
  const subdomain = getSubdomain(urlString);

  if (subdomain && subdomain.length > 0) {
    const isUUIDSubdomain = isUUID(subdomain);

    if (isUUIDSubdomain) {
      const mainDomain = getMaindomain(urlString);
      const orgId = subdomain;

      const orgSubdomain = await upsertOrg({
        orgId,
        origin,
      });

      const redirectUrl = isSubdirOrg
        ? `${origin}/${orgSubdomain}${search}`
        : `${protocol}//${orgSubdomain}.${mainDomain}${search}`;

      response = NextResponse.redirect(redirectUrl);
    }

    if (!isUUIDSubdomain && !isSubdirOrg) {
      const newUrl =
        subdomain === "api"
          ? `/${pathname}${search}`
          : `/${subdomain}${pathname}${search}`;
      response = NextResponse.rewrite(new URL(newUrl, req.url));
    }
  }

  return response;
}
