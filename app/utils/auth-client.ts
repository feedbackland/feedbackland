import { createAuthClient } from "better-auth/react";

console.log("authclient window?.location?.origin", window?.location?.origin);

export const authClient = createAuthClient({
  baseURL: window?.location?.origin,
});
