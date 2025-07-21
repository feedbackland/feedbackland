import { getIsSelfHosted } from "@/lib/utils";
import { useState, useEffect } from "react";

export function useIsSelfHosted() {
  const [isSelfHosted, setIsSelfHosted] = useState(getIsSelfHosted("client"));

  useEffect(() => {
    setIsSelfHosted(getIsSelfHosted("client"));
  }, []);

  return isSelfHosted;
}
