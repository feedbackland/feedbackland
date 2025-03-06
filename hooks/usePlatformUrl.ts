import { useState, useEffect } from "react";

function getPlatformUrl(url: string): string | null {
  try {
    const urlObject = new URL(url);
    return urlObject.origin;
  } catch (error) {
    console.error("Invalid URL:", error);
    return null;
  }
}

export function usePlatformUrl() {
  const [platformUrl, setPlatformUrl] = useState<string | null>(null);

  useEffect(() => {
    setPlatformUrl(getPlatformUrl(window.location.href));
  }, []);

  return platformUrl;
}
