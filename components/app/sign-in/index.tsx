"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SignInEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";

export function SignIn({
  onSuccess,
  onSwitch,
}: {
  onSuccess?: ({ userId }: { userId: string }) => void;
  onSwitch?: () => void;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <SSOButtonGoogle method="sign-in" />
          <Button
            variant="default"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign in with Email
          </Button>
          <Button variant="link" onClick={() => onSwitch?.()}>
            No account yet? Sign up instead.
          </Button>
        </div>
      ) : (
        <SignInEmailForm
          onSuccess={({ userId }) => onSuccess?.({ userId })}
          onClose={() => setIsEmailSelected(false)}
        />
      )}
    </>
  );
}
