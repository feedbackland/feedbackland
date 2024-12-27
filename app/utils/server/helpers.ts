import { headers } from "next/headers";
import { auth } from "@/app/utils/server/auth";

export const getSubdomain = async () => {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const subdomain = host?.split(".")?.[0];

  if (subdomain && subdomain !== "www" && !subdomain.includes("localhost")) {
    return subdomain;
  }

  return null;
};

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
};
