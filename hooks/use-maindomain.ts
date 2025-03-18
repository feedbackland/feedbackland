import { getMaindomainFromUrl } from "@/lib/utils";
import { useState, useEffect } from "react";

export function useMaindomain() {
  const [maindomain, setMaindomain] = useState<string | null>(null);

  useEffect(() => {
    setMaindomain(getMaindomainFromUrl(window.location.href));
  }, []);

  return maindomain;
}
