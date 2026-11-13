"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
export function ForgotPasswordForm({ onGoBack }: { onGoBack: () => void }) {
  const { capabilities } = useSettings();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {!capabilities.smtp ? (
        <p role="status">
          Email password reset is not configured on this board. Ask an
          administrator for a password reset link.
        </p>
      ) : sent ? (
        <p role="status">
          If this email exists, check your email for the password reset link.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            void requestPasswordReset(email)
              .then(() => setSent(true))
              .catch((failure: unknown) =>
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Reset request failed.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {error && <p role="alert">{error}</p>}
          <label className="block space-y-2">
            <span>Email</span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <Button type="submit" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <Button type="button" variant="secondary" onClick={onGoBack}>
        Go back
      </Button>
    </div>
  );
}
