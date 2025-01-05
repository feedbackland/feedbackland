import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";

export const getSubdomain = async () => {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const hostParts = host.split(".");
  const segmentCount = host.includes("localhost") ? 2 : 3;
  const subdomain = hostParts.length >= segmentCount ? hostParts[0] : null;
  return subdomain;
};

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return session;
};
