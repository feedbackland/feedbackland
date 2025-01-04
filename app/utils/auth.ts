import { betterAuth } from "better-auth";
import { dialect } from "@/app/db/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  trustedOrigins: ["*"],
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
  },
  // advanced: {
  //   crossSubDomainCookies: {
  //     enabled: true,
  //     domain: "app.localhost",
  //   },
  // },
  plugins: [nextCookies()],
});
