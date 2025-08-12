import { getVercelUrl } from "@/lib/utils";
import { useState, useEffect } from "react";

export function useVercelUrl() {
  const [vercelUrl, setVercelUrl] = useState(getVercelUrl());

  useEffect(() => {
    setVercelUrl(getVercelUrl());
  }, []);

  return vercelUrl;
}
