import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { cookieNames } from "@/lib/utils";

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get(cookieNames.subDomain);
    setSubdomain(value ?? null);
  }, []);

  return subdomain;
}
