import { useState, useEffect } from "react";
import { getSubdomainFromUrl } from "@/lib/utils";

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    setSubdomain(getSubdomainFromUrl(window.location.href));
  }, []);

  return subdomain;
}
