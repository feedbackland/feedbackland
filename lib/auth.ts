import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { dialect } from "@/db/db";
import { resend } from "@/lib/resend";
import { ResetPasswordEmail } from "@/components/emails/password-reset";
import { getHost } from "@/lib/server/utils";

export const auth = betterAuth({
  trustedOrigins: ["*"],
  database: {
    dialect,
    type: "postgres",
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token }) => {
      const host = await getHost();
      const url = `https://${host}/reset-password?token=${token}`;
      await resend.emails.send({
        from: "Feedbackland <hello@feedbackland.com>",
        to: [user.email],
        subject: "Reset your password",
        react: ResetPasswordEmail({ url }),
      });
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
      domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN as string,
    },
  },
  plugins: [nextCookies(), anonymous()],
});
