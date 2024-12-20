import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";

export const getSubdomain = async () => {
  const headersList = await headers();
  const subdomain = headersList.get("x-subdomain");
  return subdomain;
};

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
};
