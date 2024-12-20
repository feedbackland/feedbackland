import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host");
  const subdomain = hostname?.split(".")?.[0];
  const response = NextResponse.next();

  if (subdomain && subdomain !== "www" && !subdomain.includes("localhost")) {
    response.headers.set("x-subdomain", subdomain);
  } else {
    response.headers.set("x-subdomain", "");
  }

  return response;
}
