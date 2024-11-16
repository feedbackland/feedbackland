import { betterAuth } from "better-auth";
import { dialect } from "@/app/db/db";

export const auth = betterAuth({
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
  },
});
