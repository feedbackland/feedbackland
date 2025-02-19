import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export function usePlatformUrl() {
  const [platformUrl, setPlatformUrl] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get("platform-url");
    setPlatformUrl(value ?? null);
  }, []);

  return platformUrl;
}
