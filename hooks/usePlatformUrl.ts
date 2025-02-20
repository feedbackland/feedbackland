import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { cookieNames } from "@/lib/utils";

export function usePlatformUrl() {
  const [platformUrl, setPlatformUrl] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get(cookieNames.platformUrl);
    setPlatformUrl(value ?? null);
  }, []);

  return platformUrl;
}
