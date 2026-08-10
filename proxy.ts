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

/**
 * Resolves a UUID subdomain to the org's real subdomain, or `null` when that
 * cannot be determined.
 *
 * Returning `null` rather than throwing matters: this runs on the default widget
 * entry point (feedbackland-react builds `https://<platformId>.feedbackland.com`),
 * so every drawer open takes this path. `/api/org/[orgId]` answers a failed
 * lookup with `{ error: "..." }` and status 500 — which the previous
 * `(await response.json()) as string` accepted happily, producing the string
 * "[object Object]" and then a redirect target of
 * `https://[object Object].feedbackland.com`. `NextResponse.redirect` runs that
 * through URL parsing, which throws on the bracket, so `proxy()` rejected and the
 * visitor got a 500. Any cold start or database blip took the whole board down
 * instead of degrading.
 */
const getOrgSubdomain = async ({
  orgId,
  origin,
}: {
  orgId: string;
  origin: string;
}): Promise<string | null> => {
  try {
    const response = await fetch(`${origin}/api/org/${orgId}`);
    if (!response.ok) return null;
    const orgSubdomain: unknown = await response.json();
    // The route returns a bare JSON string on success and an object on failure.
    return typeof orgSubdomain === "string" && orgSubdomain.length > 0
      ? orgSubdomain
      : null;
  } catch {
    return null;
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

      // The path below the org is carried across so a deep link survives the
      // hop. Dropping it silently landed every
      // `<uuid>.feedbackland.com/<postId>` on the board index instead of the
      // post, with the query string intact so nothing looked wrong.
      //
      // Where that path starts differs by deployment: on a subdomain host the
      // org is in the hostname, so the whole pathname belongs to the org. In
      // subdir mode (localhost / *.vercel.app) `getSubdomain` reads the org off
      // the *first path segment*, so that segment has to be dropped before the
      // rest is re-attached under the resolved subdomain.
      if (orgSubdomain) {
        const belowOrg = isSubdirOrg
          ? pathname.split("/").filter(Boolean).slice(1)
          : null;
        const restPath = belowOrg
          ? belowOrg.length
            ? `/${belowOrg.join("/")}`
            : ""
          : pathname;

        const redirectUrl = isSubdirOrg
          ? `${origin}/${orgSubdomain}${restPath}${search}`
          : `${protocol}//${orgSubdomain}.${mainDomain}${restPath}${search}`;

        response = NextResponse.redirect(redirectUrl);
      }
      // Unresolvable: fall through with the untouched `next()` response rather
      // than building a malformed redirect out of it.
    }

    if (!isUUIDSubdomain && !isSubdirOrg) {
      const newUrl = `/${subdomain}${pathname}${search}`;
      response = NextResponse.rewrite(new URL(newUrl, req.url), embedHeader);
    }
  }

  return response;
}
