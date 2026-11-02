import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import nodemailer from "nodemailer";
import { getConfig } from "./config";
import { DomainError } from "./domain-error";
import { log } from "./log";

type Reset = {
  user: { id: string; email: string };
  token: string;
  url: string;
};
type ResetCapture = {
  userId: string;
  token?: string;
};
const captureKey = Symbol.for("feedbackland.reset-capture");
const root = globalThis as typeof globalThis & {
  [captureKey]?: AsyncLocalStorage<ResetCapture>;
};
// Auth is shared across Next bundle layers; its callback and callers must use
// the same request-local capture channel across those layers too.
const capture = (root[captureKey] ??= new AsyncLocalStorage<ResetCapture>());
export function smtpEnabled() {
  const config = getConfig();
  return !!(config.appUrl && config.smtp.url && config.smtp.from);
}
/** The SDK discards this callback's return value. Capture only in this request. */
export async function captureResetToken(
  userId: string,
  action: () => Promise<unknown>,
) {
  const context = { userId, token: undefined as string | undefined };
  await capture.run(context, action);
  if (!context.token)
    throw new DomainError(
      "BAD_REQUEST",
      "The password reset could not be created",
    );
  return context.token;
}
export async function sendResetPassword(reset: Reset) {
  const context = capture.getStore();
  if (context) {
    if (context.userId !== reset.user.id)
      throw new Error("Password reset capture identity mismatch");
    context.token = reset.token;
    return;
  }
  if (!smtpEnabled()) return;
  const config = getConfig();
  try {
    const url = new URL(config.smtp.url!);
    if (!["smtp:", "smtps:"].includes(url.protocol))
      throw new Error("Invalid SMTP protocol");
    for (const [name, value] of Object.entries({
      connectionTimeout: "10000",
      greetingTimeout: "10000",
      socketTimeout: "20000",
      logger: "false",
      debug: "false",
    }))
      url.searchParams.set(name, value);
    const transport = nodemailer.createTransport(url.href);
    try {
      const link = new URL(reset.url);
      if (link.origin !== config.appUrl)
        throw new Error("Reset origin mismatch");
      await transport.sendMail({
        from: config.smtp.from,
        to: reset.user.email,
        subject: "Reset your password",
        text: `Reset your password using this one-time link:\n\n${link.href}\n\nIf you did not request this, you can ignore this email.`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } finally {
      transport.close();
    }
  } catch {
    // Keep known/unknown-email responses indistinguishable, including delivery
    // failures. Never log a transport error: it can contain credentials/URLs.
    log("mail.reset-delivery-failed", {}, "warn");
  }
}
