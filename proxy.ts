import { NextRequest, NextResponse } from "next/server";
import { validate as uuidValidate } from "uuid";
import { version as uuidVersion } from "uuid";
import { getIsSubdirOrg, getMaindomain, getSubdomain } from "@/lib/utils";
import {
  EMBED_HEADER,
  EMBED_PARAM,
  parseEmbedSurface,
} from "@/lib/embed-surface";

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

const getOrgSubdomain = async ({
  orgId,
  origin,
}: {
  orgId: string;
  origin: string;
}) => {
  try {
    const response = await fetch(`${origin}/api/org/${orgId}`);
    const orgSubdomain = (await response.json()) as string;
    return orgSubdomain;
  } catch (error) {
    throw error;
  }
};

/**
 * Copies the request headers, replacing the embed-surface header with the value
 * derived from `?embed=`. The board layout reads it so the server can render the
 * embedded layout directly (see lib/embed-surface.ts).
 *
 * The header is always rewritten — never merged — so a caller cannot pick the
 * board's embedded presentation by sending the header itself.
 */
const withEmbedHeader = (req: NextRequest) => {
  const headers = new Headers(req.headers);
  const surface = parseEmbedSurface(req.nextUrl.searchParams.get(EMBED_PARAM));

  if (surface) {
    headers.set(EMBED_HEADER, surface);
  } else {
    headers.delete(EMBED_HEADER);
  }

  return { request: { headers } };
};

export async function proxy(req: NextRequest) {
  const embedHeader = withEmbedHeader(req);
  let response = NextResponse.next(embedHeader);
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
      const orgSubdomain = await getOrgSubdomain({
        orgId,
        origin,
      });
      const redirectUrl = isSubdirOrg
        ? `${origin}/${orgSubdomain}${search}`
        : `${protocol}//${orgSubdomain}.${mainDomain}${search}`;

      response = NextResponse.redirect(redirectUrl);
    }

    if (!isUUIDSubdomain && !isSubdirOrg) {
      const newUrl = `/${subdomain}${pathname}${search}`;
      response = NextResponse.rewrite(new URL(newUrl, req.url), embedHeader);
    }
  }

  return response;
}
