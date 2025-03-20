import { useState, useEffect } from "react";
import { getSubdomain } from "@/lib/utils";

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    setSubdomain(getSubdomain());
  }, []);

  return subdomain;
}
