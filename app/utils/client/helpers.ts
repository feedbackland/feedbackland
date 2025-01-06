import { getSubdomainFromHost } from "@/app/utils/helpers";

// host: "new.localhost:3000";
// hostname: "new.localhost";
// href: "http://new.localhost:3000/";
// origin: "http://new.localhost:3000";
// pathname: "/";
// port: "3000";
// protocol: "http:";

export const getSubdomain = () => {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    return getSubdomainFromHost({ host });
  }

  return null;
};

export const getRootDomain = () => {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    const hostnameParts = hostname.split(".");

    if (origin.includes("localhost")) {
      const hasSubdomain = origin.includes(".");
      return hasSubdomain ? origin.split(".").pop() : origin;
    }

    if (hostnameParts.length >= 2) {
      const tld = hostnameParts[hostnameParts.length - 1]; // Top-Level Domain (e.g., com)
      const root = hostnameParts[hostnameParts.length - 2]; // Root domain (e.g., example)
      return `${root}.${tld}`; // example.com
    }

    return hostname;
  }

  return null;
};
