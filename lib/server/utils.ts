import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSubdomainFromUrl } from "@/lib/utils";

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
};

export const getHost = async () => {
  const headersList = await headers();
  const host = headersList.get("host");
  return host as string;
};

export const getSubdomain = async () => {
  const headersList = await headers();
  const url = headersList.get("referer") as string;
  const subdomain = getSubdomainFromUrl(url);
  return subdomain;
};
