import { headers } from "next/headers";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { cookieNames } from "@/lib/utils";

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
};

export const getSubdomain = async () => {
  const cookieStore = await cookies();
  const subdomain = cookieStore.get(cookieNames.subDomain)?.value as string;
  return subdomain;
};

export const getMaindomain = async () => {
  const cookieStore = await cookies();
  const maindomain = cookieStore.get(cookieNames.mainDomain)?.value as string;
  return maindomain; // 'localhost' or 'example.com'
};

export const getPlatformUrl = async () => {
  const cookieStore = await cookies();
  const platformUrl = cookieStore.get(cookieNames.platformUrl)?.value as string;
  return platformUrl; // 'http://localhost:3000/tenant1' or 'https://tenant1.example.com'
};
