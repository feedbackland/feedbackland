import { useState, useEffect } from "react";
import { subscribe } from "@/lib/client/auth-client";
import { Session } from "better-auth";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      setSession(event.data?.session ?? null);
    });

    return () => unsubscribe();
  }, []);

  return session;
}
