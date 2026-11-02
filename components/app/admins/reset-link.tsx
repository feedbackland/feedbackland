"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/copy-text";
export function PasswordResetLink() {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.createPasswordResetLink.mutationOptions());
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Help a user reset their password</h3>
      <p className="text-muted-foreground text-sm">
        Create a one-time link for a non-admin with a password account. Send it
        privately to that person. Administrators use email or operator recovery.
      </p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setUrl(null);
          setMessage(null);
          void mutation
            .mutateAsync({ email })
            .then((result) => setUrl(result.url))
            .catch((error: unknown) =>
              setMessage(
                error instanceof Error
                  ? error.message
                  : "The reset link could not be created.",
              ),
            );
        }}
      >
        <label>
          <span className="sr-only">User email for reset link</span>
          <Input
            type="email"
            required
            placeholder="User email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setUrl(null);
            }}
          />
        </label>
        <Button type="submit" loading={mutation.isPending}>
          Create reset link
        </Button>
      </form>
      {message && <p role="alert">{message}</p>}
      {url && (
        <div className="space-y-2">
          <label className="block">
            <span>Password reset link</span>
            <Input readOnly value={url} autoComplete="off" />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void copyText(url).then((copied) =>
                setMessage(
                  copied
                    ? "Reset link copied."
                    : "Copy the reset link from the field above.",
                ),
              )
            }
          >
            Copy reset link
          </Button>
        </div>
      )}
    </section>
  );
}
