import { Resend } from "resend";

export const resend =
  process.env.RESEND_API_KEY && process.env.RESEND_EMAIL_SENDER
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
