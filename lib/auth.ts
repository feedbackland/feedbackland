import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { dialect } from "@/db/db";
import { resend } from "@/lib/resend";
import { ResetPasswordEmail } from "@/components/emails/password-reset";
import { getPlatformUrl } from "@/lib/server/utils";
import { triggers } from "@/lib/utils";

export const auth = betterAuth({
  trustedOrigins: ["*"],
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token, url }) => {
      console.log("sendResetPassword", { user, token, url });

      try {
        const platformUrl = await getPlatformUrl();
        const url = `${platformUrl}?${triggers.resetPasswordToken}=${token}`;
        await resend.emails.send({
          from: "Feedbackland <hello@feedbackland.com>",
          to: [user.email],
          subject: "Reset your password",
          react: ResetPasswordEmail({ url }),
        });
      } catch {
        throw new Error("Failed to send reset password email");
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.ROOT_DOMAIN as string,
    },
  },
  plugins: [nextCookies(), anonymous()],
});
