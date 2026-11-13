"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRuntime } from "@/lib/client-runtime";
import { recoveryAction } from "./actions";
export function RecoveryForm() {
  const [state, action, pending] = useActionState(recoveryAction, null);
  const [confirmedState, setConfirmedState] = useState<
    typeof state | undefined
  >(undefined);
  const confirmed = confirmedState === state;
  const [email, setEmail] = useState("");
  const form = useRef<HTMLFormElement>(null);
  if (state?.restored)
    return (
      <div className="space-y-4">
        <p role="status">
          Administrator access restored.{" "}
          {state.previousPassword
            ? "Your password was set by the earlier recovery attempt; use that password."
            : "Your new password is ready."}{" "}
          Sign in again to continue.
        </p>
        <p>
          Remove RECOVERY_CODE from your hosting settings and restart all
          replicas now.
        </p>
        <Link href="/">Back to feedback</Link>
      </div>
    );
  return (
    <form
      ref={form}
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        if (clientRuntime.mutationsBlocked || !confirmed)
          event.preventDefault();
      }}
    >
      {state?.error && <p role="alert">{state.error}</p>}
      <label className="block space-y-2">
        <span>Recovery code</span>
        <Input
          name="code"
          type="password"
          autoComplete="off"
          required
          maxLength={256}
          readOnly={confirmed}
        />
      </label>
      <label className="block space-y-2">
        <span>Email</span>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setConfirmedState(undefined);
          }}
          readOnly={confirmed}
        />
      </label>
      <label className="block space-y-2">
        <span>New password</span>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          readOnly={confirmed}
        />
      </label>
      {confirmed ? (
        <>
          <p role="status">
            Recover administrator access for <strong>{email.trim()}</strong>?
          </p>
          <Button
            type="submit"
            loading={pending}
            disabled={clientRuntime.mutationsBlocked}
          >
            Confirm recovery
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirmedState(undefined)}
          >
            Go back
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={() => {
            if (form.current?.reportValidity()) setConfirmedState(state);
          }}
        >
          Review recovery
        </Button>
      )}
    </form>
  );
}
