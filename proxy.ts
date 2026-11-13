import { NextRequest, NextResponse } from "next/server";
import { isPostId } from "@/lib/post-id";
import { getConfig } from "@/lib/config";
import { popupParameters } from "@/lib/auth/popup-parameters";
import {
  EMBED_HEADER,
  EMBED_PARAM,
  parseEmbedSurface,
} from "@/lib/embed-surface";
export const config = {
  matcher: ["/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)", "/robots.txt"],
};
export function proxy(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (
    req.nextUrl.pathname === "/auth/popup" &&
    req.method === "GET" &&
    site &&
    site !== "same-origin"
  )
    return new NextResponse("Open sign-in from the feedback board or widget.", {
      status: 400,
      headers: {
        "Content-Security-Policy": "frame-ancestors 'none'",
        "Cache-Control": "no-store",
      },
    });
  const segment = req.nextUrl.pathname.match(/^\/([^/]+)\/?$/)?.[1];
  const popupQuery =
    req.nextUrl.pathname === "/auth/popup"
      ? Object.fromEntries(
          [...new Set(req.nextUrl.searchParams.keys())].map((key) => {
            const values = req.nextUrl.searchParams.getAll(key);
            return [key, values.length === 1 ? values[0] : values];
          }),
        )
      : undefined;
  // Reject before the document shell starts streaming. Page-level notFound()
  // remains the fallback when a deployment does not execute the proxy.
  if (
    req.nextUrl.pathname === "/robots.txt" ||
    (popupQuery && !popupParameters.safeParse(popupQuery).success) ||
    (req.nextUrl.pathname === "/recover" && !getConfig().recoveryCode) ||
    (segment &&
      !["admin", "setup", "recover", "reset-password"].includes(segment) &&
      !isPostId(segment))
  )
    return new NextResponse("Not found", {
      status: 404,
      headers: {
        "Content-Security-Policy": "frame-ancestors 'none'",
        "Cache-Control": "no-store",
      },
    });
  const headers = new Headers(req.headers);
  const surface = parseEmbedSurface(
    req.nextUrl.searchParams.getAll(EMBED_PARAM),
  );
  headers.delete(EMBED_HEADER);
  headers.set(EMBED_HEADER, surface ?? "first-party");
  const response = NextResponse.next({ request: { headers } });
  // Next's query matcher sees only the last repeated value. Keep framing in
  // agreement with the any-match presentation contract on these public paths.
  if (
    surface &&
    (req.nextUrl.pathname === "/" || (segment && isPostId(segment)))
  )
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
  return response;
}
