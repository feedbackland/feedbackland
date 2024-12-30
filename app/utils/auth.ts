import { betterAuth } from "better-auth";
import { dialect } from "@/app/db/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  trustedOrigins: ["*"],
  database: {
    dialect,
    type: "postgres",
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false, // don't allow user to set role
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});
