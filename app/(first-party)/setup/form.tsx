"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setupAction } from "./actions";
export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, null);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <p role="alert">{state.error}</p>}
      <label className="block space-y-2">
        <span>Setup code</span>
        <Input
          name="code"
          type="password"
          required
          maxLength={256}
          autoComplete="off"
        />
      </label>
      <label className="block space-y-2">
        <span>Board name</span>
        <Input name="platformTitle" required maxLength={300} />
      </label>
      <label className="block space-y-2">
        <span>Your name</span>
        <Input name="name" required maxLength={100} autoComplete="name" />
      </label>
      <label className="block space-y-2">
        <span>Email</span>
        <Input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="block space-y-2">
        <span>Password</span>
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <Button type="submit" loading={pending}>
        Create board
      </Button>
    </form>
  );
}
