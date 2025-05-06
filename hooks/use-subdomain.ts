import { useState, useEffect } from "react";
import { getSubdomain } from "@/lib/utils";

export function useSubdomain() {
  const [subdomain, setSubdomain] = useState<string>(null as any);

  useEffect(() => {
    setSubdomain(getSubdomain() as string);
  }, []);

  return subdomain;
}
