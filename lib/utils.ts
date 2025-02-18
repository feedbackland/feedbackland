import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const reservedSubdomains = ["get-started", "auth", "public"];

export const slugifySubdomain = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w.-]+/g, "") // Remove non-alphanumeric characters (except hyphens and periods initially)
    .replace(/\.+/g, "") // Remove all periods
    .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 63); // Truncate to the maximum subdomain length (63 characters)
};

export const getSubdomainFromUrl = (urlString: string) => {
  const { hostname, pathname } = new URL(urlString);

  if (hostname.includes("localhost")) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : "";
  }

  const parts = hostname.split(".");
  return parts.length > 2 ? parts[0] : "";
};

export const getBaseDomainFromUrl = (urlString: string) => {
  const { hostname } = new URL(urlString);

  if (hostname.includes("localhost")) {
    return "localhost";
  }

  const parts = hostname.split(".");
  return parts.length <= 2 ? hostname : parts.slice(-2).join(".");
};
