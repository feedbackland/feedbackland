import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:3000",
});
