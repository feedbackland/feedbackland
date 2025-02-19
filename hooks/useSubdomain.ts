import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get("subdomain");
    setSubdomain(value ?? null);
  }, []);

  return subdomain;
}
