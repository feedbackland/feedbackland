"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export function DemoBanner() {
  const { session, isLoaded, signInWithEmail } = useAuth();

  useEffect(() => {
    if (
      window.location.hostname === "demo.feedbackland.com" &&
      isLoaded &&
      !session
    ) {
      signInWithEmail({ email: "admin@demo.com", password: "demo1234" });
    }
  }, [isLoaded, session, signInWithEmail]);

  return null;
}
