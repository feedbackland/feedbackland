import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/types";
import { NextResponse, type NextRequest } from "next/server";

const getSubdomain = (request: NextRequest) => {
  const hostname = request.headers.get("host");
  const subdomain = hostname?.split(".")?.[0];

  if (subdomain && subdomain !== "www" && !subdomain.includes("localhost")) {
    return subdomain;
  }

  return null;
};

const getSession = async (request: NextRequest) => {
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  );

  return session;
};

export default async function authMiddleware(request: NextRequest) {
  const subdomain = getSubdomain(request);
  const session = await getSession(request);
  const response = session
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/sign-in", request.url));
  response.headers.set("x-subdomain", subdomain || "");
  return response;
}

export const config = {
  matcher: ["/dashboard"],
};

// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";

// export function middleware(request: NextRequest) {
//   const hostname = request.headers.get("host");
//   const subdomain = hostname?.split(".")?.[0];
//   const response = NextResponse.next();

//   if (subdomain && subdomain !== "www" && !subdomain.includes("localhost")) {
//     response.headers.set("x-subdomain", subdomain);
//   } else {
//     response.headers.set("x-subdomain", "");
//   }

//   return response;
// }
