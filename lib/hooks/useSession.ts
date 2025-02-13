import { useState, useEffect } from "react";
import { subscribe } from "@/lib/client/auth-client";
import { Session } from "better-auth";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const listener = subscribe(({ data }) => {
      if (data && data.session) {
        setSession(data.session);
      } else {
        setSession(null);
      }
    });

    return () => {
      listener();
    };
  }, []);

  return session;
}
