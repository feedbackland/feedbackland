import { NextRequest, NextResponse } from "next/server";
import { isPostId } from "@/lib/post-id";
import {
  EMBED_HEADER,
  EMBED_PARAM,
  parseEmbedSurface,
} from "@/lib/embed-surface";
export const config = {
  matcher: ["/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)", "/robots.txt"],
};
export function proxy(req: NextRequest) {
  const segment = req.nextUrl.pathname.match(/^\/([^/]+)\/?$/)?.[1];
  // Reject before the document shell starts streaming. Page-level notFound()
  // remains the fallback when a deployment does not execute the proxy.
  if (
    req.nextUrl.pathname === "/robots.txt" ||
    (segment && segment !== "admin" && !isPostId(segment))
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
