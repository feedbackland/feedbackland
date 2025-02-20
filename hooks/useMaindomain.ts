import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { cookieNames } from "@/lib/utils";

export function useMaindomain() {
  const [maindomain, setMaindomain] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get(cookieNames.mainDomain);
    setMaindomain(value ?? null);
  }, []);

  return maindomain;
}
