import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";

export const getSubdomain = async () => {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const hostParts = host.split(".");
  const subdomain = hostParts.length > 2 ? hostParts[0] : null;
  return subdomain;
};

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return session;
};
