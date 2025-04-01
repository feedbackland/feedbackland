import { NextRequest, NextResponse } from "next/server";
import { validate as uuidValidate } from "uuid";
import { version as uuidVersion } from "uuid";
import { Org } from "@/db/schema";
import { getMaindomain, getSubdomain } from "@/lib/utils";

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
  baseUrl,
}: {
  orgId: string;
  baseUrl: string;
}) => {
  try {
    console.log("upsertOrg fetch baseUrl", baseUrl);
    console.log("upsertOrg fetch orgId", orgId);
    console.log("upsertOrg fetch fetchUrl", `${baseUrl}/api/org/upsert-org`);

    const response = await fetch(`${baseUrl}/api/org/upsert-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const org: Org = await response.json();

    console.log("upsertOrg fetch org", org);

    return org;
  } catch (error) {
    console.error("Error upserting org:", error);
    throw error;
  }
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next();
  const url = req.nextUrl.clone();
  const host = req.headers.get("host");
  const { pathname, search, origin, protocol } = url;
  const isLocalhost = host?.includes("localhost");
  const urlString = url.toString();
  const subdomain = getSubdomain(urlString);
  const mainDomain = getMaindomain(urlString);

  console.log("middleware subdomain", subdomain);

  if (subdomain && subdomain.length > 0) {
    const isUUIDSubdomain = isUUID(subdomain);

    if (isUUIDSubdomain) {
      const orgId = subdomain;
      const baseUrl = isLocalhost ? origin : `${protocol}//api.${mainDomain}`;

      console.log("baseUrl", baseUrl);
      console.log("orgId", orgId);

      const org = await upsertOrg({
        orgId,
        baseUrl,
      });

      console.log("org", org);

      const redirectUrl = isLocalhost
        ? `${origin}/${org.subdomain}`
        : `${protocol}//${org.subdomain}.${mainDomain}`;

      console.log("redirectUrl", redirectUrl);

      response = NextResponse.redirect(redirectUrl);
    }

    if (!isUUIDSubdomain && !isLocalhost) {
      const newUrl = `/${subdomain}${pathname}${search}`;
      response = NextResponse.rewrite(new URL(newUrl, req.url));
    }
  }

  return response;
}
