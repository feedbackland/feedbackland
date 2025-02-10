import { createAuthClient } from "better-auth/client";
import { createAuthMiddleware } from "better-auth/api";
import { anonymousClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  hooks: {
    after: async () => {
      console.log("zolg2");
    },
  },
  plugins: [anonymousClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
