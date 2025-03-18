import { getPlatformUrl } from "@/lib/utils";
import { useState, useEffect } from "react";

export function usePlatformUrl() {
  const [platformUrl, setPlatformUrl] = useState<string | null>(null);

  useEffect(() => {
    setPlatformUrl(getPlatformUrl(window.location.href));
  }, []);

  return platformUrl;
}
