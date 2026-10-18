import { NextRequest, NextResponse } from "next/server";
import {
  EMBED_HEADER,
  EMBED_PARAM,
  parseEmbedSurface,
} from "@/lib/embed-surface";
export const config = {
  matcher: ["/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)"],
};
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  const surface = parseEmbedSurface(req.nextUrl.searchParams.get(EMBED_PARAM));
  headers.delete(EMBED_HEADER);
  if (surface) headers.set(EMBED_HEADER, surface);
  return NextResponse.next({ request: { headers } });
}
