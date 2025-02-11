import { createAuthClient } from "better-auth/client";
import { anonymousClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [anonymousClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
