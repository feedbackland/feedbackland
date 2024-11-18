import { betterAuth } from "better-auth";
import { dialect } from "@/app/db/db";
import { headers } from "next/headers";

export const auth = betterAuth({
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const headerList = await headers();
          const pathname = headerList?.get("x-current-path");
          console.log("pathname", pathname);

          return {
            data: {
              ...session,
              org: "zolg",
            },
          };
        },
      },
    },
  },
});
