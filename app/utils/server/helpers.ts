import { headers } from "next/headers";
import { auth } from "@/app/utils/auth";
import { getSubdomainFromHost } from "@/app/utils/helpers";

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
  return getSubdomainFromHost({ host });
};

export const getSession = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return session;
};
