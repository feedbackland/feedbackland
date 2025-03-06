import { useState, useEffect } from "react";

function getSubdomain(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === "localhost") {
      // Extract first path segment for localhost
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      return pathSegments.length > 0 ? pathSegments[0] : null;
    } else {
      // Extract subdomain for remote URLs
      const hostParts = parsedUrl.hostname.split(".");
      return hostParts.length > 2 ? hostParts[0] : null;
    }
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    setSubdomain(getSubdomain(window.location.href));
  }, []);

  return subdomain;
}
