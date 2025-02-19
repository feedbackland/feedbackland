import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export function useMaindomain() {
  const [maindomain, setMaindomain] = useState<string | null>(null);

  useEffect(() => {
    const value = Cookies.get("maindomain");
    setMaindomain(value ?? null);
  }, []);

  return maindomain;
}
