import { betterAuth } from "better-auth";
import { dialect } from "@/db/db";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";

export const auth = betterAuth({
  trustedOrigins: ["*"],
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      // requireSelectAccount: true,
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN as string,
    },
  },
  plugins: [nextCookies(), anonymous()],
});
