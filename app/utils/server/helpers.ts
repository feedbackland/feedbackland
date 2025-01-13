import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";

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
  return host;
};

export const getSubdomain = async () => {
  const headersList = await headers();
  const subdomain = headersList.get("x-org-subdomain") || "";
  return subdomain;
};
