import { getPlatformUrl } from "@/lib/utils";
import { useState, useEffect } from "react";

export function usePlatformUrl() {
  const [platformUrl, setPlatformUrl] = useState(getPlatformUrl());

  useEffect(() => {
    setPlatformUrl(getPlatformUrl());
  }, []);

  return platformUrl;
}
