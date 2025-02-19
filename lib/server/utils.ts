import { headers } from "next/headers";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session;
};

export const getSubdomain = async () => {
  const cookieStore = await cookies();
  const subdomain = cookieStore.get("subdomain")?.value as string;
  return subdomain;
};

export const getMaindomain = async () => {
  const cookieStore = await cookies();
  const maindomain = cookieStore.get("maindomain")?.value as string;
  return maindomain; // 'localhost' or 'example.com'
};

export const getPlatformUrl = async () => {
  const cookieStore = await cookies();
  const platformUrl = cookieStore.get("platform-url")?.value as string;
  return platformUrl; // 'http://localhost:3000/tenant1' or 'https://tenant1.example.com'
};
