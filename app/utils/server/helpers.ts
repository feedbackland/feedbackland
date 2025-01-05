import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";

// host: "new.localhost:3000";
// hostname: "new.localhost";
// href: "http://new.localhost:3000/";
// origin: "http://new.localhost:3000";
// pathname: "/";
// port: "3000";
// protocol: "http:";

export const getSubdomain = async () => {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const parts = host.split(".");

  if (host.includes("localhost") && parts.length === 2) {
    return parts[0];
  }

  if (!host.includes("localhost") && parts.length === 3 && parts[0] !== "www") {
    return parts[0];
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
