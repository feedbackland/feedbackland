import { betterAuth } from "better-auth";
import { dialect } from "@/app/db/db";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  trustedOrigins: [
    "http://*.localhost:3000/",
    "*.localhost:3000/",
    "*",
    "https://*",
    "http://*",
  ],
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});
