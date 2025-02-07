"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";

export function SignUp({
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
          <SSOButtonGoogle method="sign-up" />
          <Button
            variant="default"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign up with email
          </Button>
          <Button variant="link" onClick={() => onSwitch?.()}>
            Already have an account? Sign in instead.
          </Button>
        </div>
      ) : (
        <SignUpEmailForm
          onSuccess={({ userId }) => onSuccess?.({ userId })}
          onClose={() => setIsEmailSelected(false)}
        />
      )}
    </>
  );
}
