"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SSOButtonMicrosoft } from "@/components/app/sso/sso-button-microsoft";
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
          <SSOButtonMicrosoft method="sign-up" />
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign up with email
          </Button>
          <div className="m-auto mt-4 flex items-center">
            <span className="mr-1 text-sm text-muted-foreground">
              Already have an account?
            </span>
            <Button
              variant="link"
              onClick={() => onSwitch?.()}
              className="p-0 text-sm text-muted-foreground underline hover:text-foreground"
            >
              Sign in
            </Button>
          </div>
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
