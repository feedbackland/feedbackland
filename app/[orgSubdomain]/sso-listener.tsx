"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";

export function SSOListener() {
  const [ssoSuccesss, setSSOSuccess] = useQueryState("sso_success");

  useEffect(() => {
    if (ssoSuccesss) {
      console.log("zolg");
      setSSOSuccess(null);
    }
  }, [ssoSuccesss]);

  return null;
}
