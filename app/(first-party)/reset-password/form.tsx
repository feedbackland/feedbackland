"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSurfaceAuthClient } from "@/lib/auth/client";
import { clientRuntime } from "@/lib/client-runtime";
export function ResetPasswordForm({
  token,
  invalid,
}: {
  token: string | null;
  invalid: boolean;
}) {
  const [client] = useState(() => createSurfaceAuthClient("first-party"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  if (done)
    return (
      <div className="space-y-4">
        <p role="status">
          Password reset. Sign in again with your new password.
        </p>
        <Link href="/">Back to feedback</Link>
      </div>
    );
  if (!token || invalid)
    return (
      <div className="space-y-4">
        <p role="alert">
          This password reset link is invalid, expired or already used.
        </p>
        <Link href="/">Return to the board to request a new link</Link>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || clientRuntime.mutationsBlocked) return;
        setBusy(true);
        setError(null);
        void client
          .resetPassword({ token, newPassword: password.trim() })
          .then((result) => {
            if (result.error)
              throw new Error(
                "This reset link could not be used. Request a new link and try again.",
              );
            setPassword("");
            setDone(true);
            window.history.replaceState(null, "", "/reset-password");
          })
          .catch((failure: unknown) =>
            setError(
              failure instanceof Error
                ? failure.message
                : "Password reset failed.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      {error && <p role="alert">{error}</p>}
      <label className="block space-y-2">
        <span>New password</span>
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <Button
        type="submit"
        loading={busy}
        disabled={clientRuntime.mutationsBlocked}
      >
        Reset password
      </Button>
    </form>
  );
}
