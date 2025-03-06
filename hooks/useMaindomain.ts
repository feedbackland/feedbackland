import { useState, useEffect } from "react";

function getMaindomain(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === "localhost") {
      return "localhost"; // Return 'localhost' for local development
    }

    const hostParts = parsedUrl.hostname.split(".");
    if (hostParts.length > 2) {
      // Handles subdomains like "tenant1.feedbackland.com"
      return hostParts.slice(-2).join(".");
    } else {
      // Handles domains like "feedbackland.com"
      return parsedUrl.hostname;
    }
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export function useMaindomain() {
  const [maindomain, setMaindomain] = useState<string | null>(null);

  useEffect(() => {
    setMaindomain(getMaindomain(window.location.href));
  }, []);

  return maindomain;
}
