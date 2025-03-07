import { NextRequest, NextResponse } from "next/server";
import { validate as uuidValidate } from "uuid";
import { version as uuidVersion } from "uuid";
import { Org } from "@/db/schema";
import { getMaindomainFromUrl, getSubdomainFromUrl } from "@/lib/utils";

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

const fetchUpsertOrg = async ({
  orgId,
  baseUrl = "",
}: {
  orgId: string;
  baseUrl?: string;
}) => {
  try {
    const response = await fetch(`${baseUrl}/api/org/upsert-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orgId }),
    });

    const org: Org = await response.json();
    return org;
  } catch (error) {
    console.error("Error upserting org:", error);
    throw error;
  }
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

  return response;
}
