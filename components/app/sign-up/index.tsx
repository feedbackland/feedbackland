"use client";

import { Button } from "@/components/ui/button";
import { SSOButtonGoogle } from "@/components/app/sso/sso-button-google";
import { SSOButtonMicrosoft } from "@/components/app/sso/sso-button-microsoft";
import { SSOButtonAnonymous } from "@/components/app/sso/sso-button-anonymous";
import { SignUpEmailForm } from "./email-form";
import { useState } from "react";
import { Mail } from "lucide-react";

export function SignUp({
  onSuccess,
  onSelectedMethodChange,
  includeAnonymous,
  context,
}: {
  onSuccess: ({ userId }: { userId: string }) => void;
  onSelectedMethodChange?: () => void;
  includeAnonymous?: boolean;
  context?: string;
}) {
  const [isEmailSelected, setIsEmailSelected] = useState(false);

  const handleOnSuccess = ({ userId }: { userId: string }) => {
    onSuccess({ userId });
  };

  return (
    <>
      {!isEmailSelected ? (
        <div className="flex flex-col space-y-4">
          <SSOButtonGoogle context={context} />
          <SSOButtonMicrosoft context={context} />
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEmailSelected(true)}
          >
            <Mail className="size-5" />
            Sign up with Email
          </Button>
          {includeAnonymous && (
            <SSOButtonAnonymous onSuccess={handleOnSuccess} />
          )}
          <div className="m-auto mt-4 flex items-center">
            <span className="mr-1 text-sm text-foreground">
              Already have an account?
            </span>
            <Button
              variant="link"
              onClick={() => onSelectedMethodChange?.()}
              className="p-0 underline"
            >
              Sign in
            </Button>
          </div>
        </div>
      ) : (
        <SignUpEmailForm
          onSuccess={handleOnSuccess}
          onClose={() => setIsEmailSelected(false)}
        />
      )}
    </>
  );
}
